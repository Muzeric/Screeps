#!/usr/bin/perl -w

use strict;
use Term::ReadKey;
use Mail::IMAPClient;
use MIME::Parser;
use Data::Dumper;
use Encode;
use utf8;

use POSIX;
use locale; 
setlocale LC_NUMERIC, "fr_FR";

binmode STDOUT, ':utf8';

$| = 1;

my $password = _get_passwd();

my $imap = new Mail::IMAPClient(
	Server => 'imap.gmail.com',
	Ssl => 1,
	Uid => 1,
	User => 'yamuzer@gmail.com',
	Password => $password,
	Port => 993,
)
or die "Couldn't connect: $@\n";
print "Connected\n";

#my $output = $imap->tag_and_run("ENABLE UTF8=ACCEPT")
#or die "Could not tag_and_run: $@\n";

my $folder = 'Inbox';
$imap->select($folder)
or print STDERR "select '$folder': ".$imap->LastError."\n"
and die;
print "Selected '$folder'\n";

my @msgs = $imap->search('SUBJECT screeps')
or print STDERR "Search in '$folder': ".$imap->LastError."\n"
and die;
print "Searching in '$folder'\n";

print "Got ".scalar(@msgs)." emailes\n";
my $parser = MIME::Parser->new;
$parser->tmp_to_core(1);
$parser->output_to_core(1);
my $count = 0;
my $info = {};
foreach my $msg (@msgs) {
  print "\r".$count++." ($msg)           ";

  my $string = $imap->message_string($msg) 
  or print STDERR "getting meassage: ".$imap->LastError."\n"
  and die;

  #print "String: $string\n";

  my $entity = $parser->parse_data($string);
  #$entity->dump_skeleton(\*STDERR);
  my $content = split_entity($entity);
  #print "Before: ".$content."\n";
  #$content = decode_base64($content);
  $content = decode("utf8", $content);
  #print "Unbased: ".$content."\n";
  my ($comp) = $content =~ /\d+ notification received:\s*(.+\:\{"memory.+)\s*\[msg\]/sg;
  
  if (!$comp) {
    print "Not parsed: ".substr($content, 0, 20)."\n";
  } else {
    my $eh = lzw_decode($comp);
    #print "After:  ".$eh."\n";
    my ($tick, $jshash) = $eh =~ /^(\d+):(.+)$/;
    $jshash =~ s/:/=>/g;
    if (my $hash = eval($jshash) ) {
      $info->{$tick} = $hash;
    } else {
      print "Can't eval: $jshash\n";
    }
  }
}
print "\n";

open(STAT, ">stat.csv")
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

open(RUN, ">stat_run.csv")
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
