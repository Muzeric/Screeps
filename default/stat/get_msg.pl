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
my $msg = shift @ARGV || die;

my $password = _get_passwd();

my $imap = new Net::IMAP::Simple::Gmail('imap.gmail.com', 'debug' => 0, 'Uid' => 1)
or die "Couldn't connect: $@\n";
print "Connected\n";

$imap->login('yamuzer@gmail.com' => $password);

$imap->select('Inbox');

my $string = $imap->get($msg)
or print STDERR "getting meassage: ".$imap->errstr."\n"
and die;
$string = "$string";

#print "String: $string\n";
my $parser = MIME::Parser->new;
$parser->tmp_to_core(1);
$parser->output_to_core(1);
my $entity = $parser->parse_data($string);
my $content = split_entity($entity);
$content = decode("utf8", $content);

my $comp;
my $tick;
if ($content =~ /CPUHistory/) {
  ($tick, $comp) = $content =~ /\d+ notification received:\s*CPUHistory:(\d+):(.+)#END#/sg;
} else {
  ($comp) = $content =~ /\d+ notification received:\s*(.+\:\{"memory.+)\s*\[msg\]/sg;
}

if (!$comp) {
  $content =~ s/[\n\r]/ /g;
  print "Not parsed: ".substr($content, 0, 50)." ... ".substr($content, -50)."\n";
} else {
  my $eh = lzw_decode($comp);
  #print "After:  ".$eh."\n";
  my $jshash;
  if (!$tick) {
    ($tick, $jshash) = $eh =~ /^(\d+):(.+)$/;
  } else {
    $jshash = $eh;
  }
  print "$tick: $jshash\n";
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
