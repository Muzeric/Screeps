#!/usr/bin/perl -w

use strict;
use Term::ReadKey;
#use Mail::IMAPClient;
use Net::IMAP::Simple::Gmail;
use MIME::Parser;
use Data::Dumper;
use Encode;
use utf8;

use POSIX;
#use locale; 
#setlocale LC_CTYPE, 'en_US.UTF-8';

binmode STDOUT, ':utf8';

$| = 1;

my $password = _get_passwd();

my $imap = new Net::IMAP::Simple::Gmail('imap.gmail.com', 'debug' => 0, 'Uid' => 1)
or die "Couldn't connect: $@\n";
print "Connected\n";

$imap->login('yamuzer@gmail.com' => $password);

my @msgs = $imap->search('SUBJECT screeps X-GM-LABELS ScreepsInput')
or print STDERR "Searching: ".$imap->errstr."\n";

print "Got ".scalar(@msgs)." emailes\n";
exit if scalar(@msgs) == 0;

my $room_versions = {
  '1' => ['harvest', 'create', 'build', 'repair', 'upgrade', 'pickup', 'cpu'],
  '2' => ['harvest', 'create', 'build', 'repair', 'upgrade', 'pickup', 'dead', 'cpu'],
  '3' => ['harvest', 'create', 'build', 'repair', 'upgrade', 'pickup', 'dead', 'lost', 'cpu'],
};

my $parser = MIME::Parser->new;
$parser->tmp_to_core(1);
$parser->output_to_core(1);
my $count = 1;
my @msgs_done = ();
my @msgs_bad = ();
foreach my $msg (@msgs) {
  my $prefix = "\r$count ($msg)           ";
  print $prefix;

  #my $string = $imap->message_string($msg) 
  my $string = $imap->get($msg)
  or print STDERR "${prefix}getting meassage: ".$imap->errstr."\n"
  and next;
  $string = "$string";

  #print "String: $string\n";

  my $entity = $parser->parse_data($string);
  #$entity->dump_skeleton(\*STDERR);
  my $content = split_entity($entity);
  #print "Before: ".$content."\n";
  #$content = decode_base64($content);
  $content = decode("utf8", $content);
  #print "Unbased: ".$content."\n";
  #print Dumper($imap->get_labels($msg));

  my $good = 0;
  my $cpu_out = '';
  my $room_out = '';
  my ($tick, $comp, $version);
  foreach my $str (split(/\n/, $content)) {
    if ($str =~ /\d+ notifications? received on.*shard|\[msg\]|^$/) {
      ;
    } elsif (($tick, $comp) = $str =~ /CPUHistory:(\d+):(.+)#END#/g) {
      my $jshash = lzw_decode($comp);
      $jshash =~ s/:/=>/g;
      if (my $hash = eval($jshash) ) {
        $cpu_out .= "$tick\n$jshash\n";
        $good = 1;       
      } else {
        print STDERR "${prefix}can't eval: ".substr($jshash, 0, 50)." ... ".substr($jshash, -50)."\n";
      }
    } elsif (($version, $tick, $comp) = $str =~ /room\.(\d+):(\d+):(.+)#END#/g) {
      if (!exists($room_versions->{$version})) {
        print STDERR "${prefix}No version=$version\n";
        next;
      }
      my $hash = {};
      $room_out .= "$tick\n";
      $room_out .= "{";
      foreach my $roomt (split(/;/, lzw_decode($comp))) {
        my $i = -1;
        foreach my $value (split(/:/, $roomt)) {
          if ($i == -1) {
            $room_out .= "\"$value\"=>{";
          } else {
            $room_out .= "\"".$room_versions->{$version}->[$i]."\"=>$value,";
          }
          $i++;
        }
        $room_out .= "},";
      }
      $room_out .= "}\n";
      $good = 1;
    } else {
      #print "not parsed: ".substr($str, 0, 50)." ... ".substr($str, -50)."\n";
      print STDERR "${prefix}not parsed: $str\n";
    }

  }
  
  if ($good) {
    push(@msgs_done, $msg);
  } else {
    push(@msgs_bad, $msg);
  }

  if ($cpu_out) {
    open(MSGF, ">mail_cpu/m$msg.msg")
    or die $@;        
  
    print MSGF "$cpu_out\n";
    close(MSGF);
  }
  if ($room_out) {
    open(MSGF, ">mail_room/m$msg.msg")
    or die $@;        
  
    print MSGF "$room_out\n";
    close(MSGF);
  }
  
  $count++;
}
print "\n";

print "We have ".scalar(@msgs_done)." done msgs\n";
$count = 1;
foreach my $msg (@msgs_done) {
  print "\r$count ($msg)           ";
  $imap->remove_labels($msg, qw/ScreepsInput/);
  $imap->add_labels($msg, qw/ScreepsArchive/);
  $count++;
}
print "\n";

print "We have ".scalar(@msgs_bad)." bad msgs\n";
$count = 1;
foreach my $msg (@msgs_bad) {
  print "\r$count ($msg)           ";
  $imap->remove_labels($msg, qw/ScreepsInput/);
  $imap->add_labels($msg, qw/ScreepsOther/);
  $count++;
}
print "\n";

sub lzw_decode {
    my $s = shift;
    my $dict = {};
    my $currChar = substr($s, 0, 1);
    my $oldPhrase = $currChar;
    my $out = $currChar;
    my $code = 256;
    my $phrase;
    for (my $i = 1; $i < length($s); $i++) {
        my $currCode = ord(substr($s, $i, 1));
        if ($currCode < 256) {
            $phrase = substr($s, $i, 1);
        } else {
            $phrase = $dict->{$currCode} ? $dict->{$currCode} : $oldPhrase.$currChar;
        }
        $out .= $phrase;
        $currChar = substr($phrase, 0, 1);
        $dict->{$code} = $oldPhrase.$currChar;
        $code++;
        $oldPhrase = $phrase;
    }
    return $out;
}

sub split_entity {
  my $entity = shift;
  my $res = '';
  my $num_parts = $entity->parts; # how many mime parts?
  if ($num_parts) { # we have a multipart mime message
    foreach (1..$num_parts) {
      $res .= split_entity( $entity->parts($_ - 1) ); # recursive call
    }
  } else { # we have a single mime message/part
    if ($entity->effective_type =~ /^text\/plain$/) { # text message
      $res .= $entity->bodyhandle->as_string;
      #$res .= $entity->stringify_body;
    }
  }

  return $res;
}

sub _get_passwd {
	print "Password: ";
	ReadMode('noecho');
	my $password = ReadLine(0);
	chomp($password);
	ReadMode('normal');
	print ('*' x length($password)); 
	print "\n";

	return $password;
}
