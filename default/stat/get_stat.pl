#!/usr/bin/perl -w

use lib ('/opt/lib/perl5/site_perl');
use lib ('/opt/lib/perl5/site_perl/5.10.0');
use lib ('/opt/lib/perl5/site_perl/5.10.0/i686-linux');

use strict;
use Net::IMAP::Simple;
use Net::IMAP::Simple::Gmail;
use MIME::Parser;
use Data::Dumper;
use Encode;
use utf8;
#use InfluxDB::HTTP;
use POSIX;
use Date::Parse;
#use locale; 
#setlocale LC_CTYPE, 'en_US.UTF-8';

binmode STDOUT, ':utf8';
$| = 1;

print "\n\n";
print localtime()." started\n";

#my $influx = InfluxDB::HTTP->new(host => '192.168.1.41');

#my $ping = $influx->ping();
#unless ($ping) {
#  die "Can't connect to influx\n";
#}

my $influx_file = "influx.data";
open(INFLUX, ">>$influx_file")
or die $@;

my $password = $ENV{'PASSWORD'} || shift @ARGV;
die unless $password;

$Data::Dumper::Indent = 0;
$Data::Dumper::Terse = 1;
$Data::Dumper::Quotekeys = 0;
$Data::Dumper::Pair = '=';

my $imap = new Net::IMAP::Simple::Gmail('imap.gmail.com', 'debug' => 0, 'Uid' => 1)
or die "Couldn't connect: $@\n";
print "Connected\n";

$imap->login('yamuzer@gmail.com' => $password);

my @msgs = $imap->search('SUBJECT screeps X-GM-LABELS ScreepsInput')
or die "Searching: ".($imap->errstr || ' failed without errors')."\n";

print "Got ".scalar(@msgs)." emailes\n";
exit if scalar(@msgs) == 0;

my $room_versions = {
  '4' => ['harvest', 'create', 'build', 'repair', 'upgrade', 'pickup', 'dead', 'lost', 'cpu', 'send'],
};

my $role_versions = {
  '2' => ['harvest', 'create', 'build', 'repair', 'upgrade', 'pickup', 'dead', 'cpu', 'sum'],
};

my $parser = MIME::Parser->new;
$parser->tmp_to_core(1);
$parser->output_to_core(1);
my $count = 0;
foreach my $msg (@msgs) {
  my $prefix = "$count ($msg)\t ";

  my $date = $imap->fetch($msg, "INTERNALDATE");
  my $unixtime = str2time($date) || 0;
  $unixtime .= '000000000';

  my $string = $imap->get($msg)
  or die "${prefix}getting meassage failed\n";
  $string = "$string";

  my $entity = $parser->parse_data($string);
  my $content = split_entity($entity);
  $content = decode("utf8", $content);

  my $good = 0;
  my ($tick, $comp, $version);
  foreach my $str (split(/\n/, $content)) {
    if ($str =~ /\d+ notifications? received on.*shard|\[msg\]|^$|\[error\]/) {
      ;
    } elsif ($str =~ /Script execution has been interrupted with a hard reset: CPU limit reached/) {
      my $data = "error limit=1 $unixtime";
      print INFLUX "$data\n";
    } elsif ($str =~ /Script execution timed out: CPU limit reached/) {
      my $data = "error timeout=1 $unixtime";
      print INFLUX "$data\n";
    } elsif ($str =~ /Script execution has been terminated: CPU bucket is empty/) {
      my $data = "error bucket=1 $unixtime";
      print INFLUX "$data\n";
    } elsif (($version, $tick, $comp) = $str =~ /CPU\.(\d+):(\d+):(.+)#END#/g) {
      my $jshash = lzw_decode($comp);
      $jshash =~ s/:/=>/g;
      if (my $hash = eval($jshash) ) {
        my $flags = Dumper($hash);
        $flags =~ s/["'{}]//g;
        my $data = "cpu tick=$tick,$flags $unixtime";
      	print INFLUX "$data\n";
        $good = 1;
      } else {
        print STDERR "${prefix}can't eval: ".substr($jshash, 0, 50)." ... ".substr($jshash, -50)."\n";
      }
    } elsif (($version, $tick, $comp) = $str =~ /total\.(\d+):(\d+):(.+)#END#/g) {
      my $jshash = lzw_decode($comp);
      $jshash =~ s/:/=>/g;
      if (my $hash = eval($jshash) ) {
        my $flags = Dumper($hash);
        $flags =~ s/["'{}]//g;
        my $data = "total tick=$tick,$flags $unixtime";
      	print INFLUX "$data\n";
        $good = 1;
      } else {
        print STDERR "${prefix}can't eval: ".substr($jshash, 0, 50)." ... ".substr($jshash, -50)."\n";
      }
    } elsif (($version, $tick, $comp) = $str =~ /mineral\.(\d+):(\d+):(.+)#END#/g) {
      my $jshash = lzw_decode($comp);
      $jshash =~ s/:/=>/g;
      if (my $hash = eval($jshash) ) {
        while (my ($rt, $arr) = each %$hash) {
          my $data = "mineral,rt=$rt store=".$arr->[0].",need=".$arr->[1]." $unixtime";
          print INFLUX "$data\n";
        }
        $good = 1;
      } else {
        print STDERR "${prefix}can't eval: ".substr($jshash, 0, 50)." ... ".substr($jshash, -50)."\n";
      }
    } elsif (($version, $tick, $comp) = $str =~ /room\.(\d+):(\d+):(.+)#END#/g) {
      if (!exists($room_versions->{$version})) {
        print STDERR "${prefix}No room version=$version\n";
        next;
      }
      
      foreach my $roomt (split(/;/, lzw_decode($comp))) {
        my $data = "";
        my $i = -1;
        foreach my $value (split(/:/, $roomt)) {
          if ($i == -1) {
            $data .= "room,roomName=$value "
          } else {
            $data .= "," if ($i > 0);
            $data .= $room_versions->{$version}->[$i]."=$value";
          }
          $i++;
        }
        $data .= " $unixtime";
      	print INFLUX "$data\n";
      }
      $good = 1;
    } elsif (($version, $tick, $comp) = $str =~ /role\.(\d+):(\d+):(.+)#END#/g) {
      if (!exists($role_versions->{$version})) {
        print STDERR "${prefix}No role version=$version\n";
        next;
      }

      foreach my $rolet (split(/;/, lzw_decode($comp))) {
        my $data = "";
        my $i = -1;
        foreach my $value (split(/:/, $rolet)) {
          if ($i == -1) {
            $data .= "role,role=$value "
          } else {
            $data .= "," if ($i > 0);
            $data .= $role_versions->{$version}->[$i]."=$value";
          }
          $i++;
        }
        $data .= " $unixtime";
      	print INFLUX "$data\n";
      }
      $good = 1;
    } else {
      if (length($str) > 105) {
        print STDERR "${prefix}not parsed: ".substr($str, 0, 50)." ... ".substr($str, -50)."\n";
      } else {
        print STDERR "${prefix}not parsed: $str\n";
      }
      my $data = "error parsing=1 $unixtime";
      print INFLUX "$data\n";
      #print STDERR "${prefix}not parsed: $str\n";
    }

  }

  if ($good) {
    $imap->remove_labels($msg, qw/ScreepsInput/);
    $imap->add_labels($msg, qw/ScreepsArchive/);
  } else {
    $imap->remove_labels($msg, qw/ScreepsInput/);
    $imap->add_labels($msg, qw/ScreepsOther/);  
  }
  
  $count++;
  last if $count >= 100;
}

close(INFLUX)
or die $@;

if (-f $influx_file) {
	my $res = `curl -i -XPOST 'http://192.168.1.41:8086/write?db=screeps&epoch=s' --data-binary \@$influx_file`;
	unlink($influx_file);
	print "Write to influx with res=$res\n";
	#my $res = $influx->write(\@influx_data, database => "screeps", precision => "s");
	#print "Influx result: ".$res."\n" if !$res;
}


print localtime()." we done $count msgs\n";

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
