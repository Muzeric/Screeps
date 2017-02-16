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

my $parser = MIME::Parser->new;
$parser->tmp_to_core(1);
$parser->output_to_core(1);
my $count = 1;
my $info = {};
my $max_tick = 0;
my @msgs_done = ();
my @msgs_bad = ();
foreach my $msg (@msgs) {
  print "\r$count ($msg)           ";

  #my $string = $imap->message_string($msg) 
  my $string = $imap->get($msg)
  or print STDERR "getting meassage: ".$imap->errstr."\n"
  and die;
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

  my $comp;
  my $tick;
  if ($content =~ /CPUHistory/) {
    ($tick, $comp) = $content =~ /\d+ notification received:\s*CPUHistory:(\d+):(.+)#END#/sg;
    print "\r$count ($msg) NEW!         ";
  } else {
    ($comp) = $content =~ /\d+ notification received:\s*(.+\:\{"memory.+)\s*\[msg\]/sg;
  }
  
  if (!$comp) {
    #$content = encode_utf8($content);
    $content =~ s/[\n\r]/ /g;
    print "not parsed: ".substr($content, 0, 50)." ... ".substr($content, -50)."\n";
    push(@msgs_bad, $msg);
  } else {
    my $eh = lzw_decode($comp);
    #print "After:  ".$eh."\n";
    my $jshash;
    if (!$tick) {
      ($tick, $jshash) = $eh =~ /^(\d+):(.+)$/;
    } else {
      $jshash = $eh;
    }
    $jshash =~ s/:/=>/g;
    if (my $hash = eval($jshash) ) {
      $info->{$tick} = $hash;
      $max_tick = $tick if ($tick > $max_tick);
      push(@msgs_done, $msg);
    } else {
      print "can't eval: ".substr($jshash, 0, 50)." ... ".substr($jshash, -50)."\n";
      push(@msgs_bad, $msg);
    }
  }
  $count++;
  #last if $count > 10;
}
print "\n";

setlocale LC_NUMERIC, "fr_FR";

open(STAT, ">stat_cpu_total.$max_tick.csv")
or die $@;

my $runkeys = {};
my $first = 0;
foreach my $tick (sort {$a <=> $b} keys %$info) {
  my $hash = $info->{$tick};
  print STAT "tick\t".join("\t", sort keys %$hash)."\n" if !$first++;
  print STAT $tick;
  foreach my $key (sort keys %$hash) {
    print STAT "\t$hash->{$key}->{cpu}";
  }
  print STAT "\n";

  my $run = $hash->{"run"}->{"info"};
  foreach my $key (keys %$run) {
    $runkeys->{$key} = 1;
  }
}
close(STAT);

open(RUN, ">stat_cpu_run.$max_tick.csv")
or die $@;
print RUN "tick\t".join("\t", sort keys %$runkeys)."\n";
foreach my $tick (sort {$a <=> $b} keys %$info) {
  my $hash = $info->{$tick};
  my $run = $hash->{"run"}->{"info"};
  print RUN $tick;
  foreach my $key (sort keys %$runkeys) {
    my $value = exists $run->{$key} ? sprintf("%0.2f", $run->{$key}->{"cpu"} / $run->{$key}->{"sum"}) : 0;
    print RUN "\t$value";
  }
  print RUN "\n";
}
close(RUN);

$imap->select('Inbox')
or print STDERR "select 'Inbox': ".$imap->LastError."\n"
and die;

print "We have ".scalar(@msgs_done)." done msgs\n";
$count = 1;
foreach my $msg (@msgs_done) {
  print "\r$count ($msg)           ";
  $imap->remove_labels($msg, qw/ScreepsInput/);
  $imap->add_labels($msg, qw/ScreepsArchive/);
  $count++;
}

print "We have ".scalar(@msgs_bad)." bad msgs\n";
$count = 1;
foreach my $msg (@msgs_bad) {
  print "\r$count ($msg)           ";
  $imap->remove_labels($msg, qw/ScreepsInput/);
  $imap->add_labels($msg, qw/ScreepsOther/);
  $count++;
}

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
