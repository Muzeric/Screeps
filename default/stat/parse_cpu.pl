#!/usr/bin/perl -w

use strict;
use Data::Dumper;
use Encode;
use utf8;

use POSIX;
use InfluxDB::HTTP;
#use locale; 
#setlocale LC_CTYPE, 'en_US.UTF-8';

my $influx = InfluxDB::HTTP->new(host => '192.168.1.41');

my $ping = $influx->ping();
unless ($ping) {
  print "Can't connect to influx\n";
  exit;
}

my $limit = shift @ARGV || 0;
binmode STDOUT, ':utf8';
$| = 1;

my @files = glob('mail_cpu/m*.msg');
print "Got ".scalar(@files)." files\n";

sub sortf {
  my ($n1) = $a =~ /m(\d+)\.msg/;
  my ($n2) = $b =~ /m(\d+)\.msg/;
  return $n1 <=> $n2;
}

if ($limit) {
  my @new_files = sort sortf @files;
  @files = splice(@new_files, -$limit);
}
print "Splice to ".scalar(@files)." files\n";

my $info = {};
my $count = 1;
my $total_keys = {};
foreach my $file (@files) {
  open(F, $file)
  or die $@;

  my $first = <F>;
  chomp($first);
  my ($tick, $unixtime, $version) = split(/,/, $first);
  $unixtime ||= 0;
  $version ||= 0;
  unless ($tick =~ /^\d+$/) {
    print STDERR "tick is not a number in $file: $tick\n";
    next;
  }
  my $jshash = <F>;
  chomp($jshash);

  if (my $hash = eval($jshash) ) {
    $info->{$tick} = [$version, $unixtime, $hash];
    foreach my $key (keys %$hash) {
      $total_keys->{$key} = 1;
    }
  } else {
    print "can't eval ($@): ".substr($jshash, 0, 50)." ... ".substr($jshash, -50)."\n";
  }
  $count++;
  close(F);
}

my @ticks = sort {$a <=> $b} keys %$info;
print "Got ".scalar(@ticks)." ticks\n";
if ($limit && scalar(@ticks) > $limit) {
  @ticks = splice(@ticks, -$limit);
}
my $extra = {};
my $excel_extra = {
  bucket => undef,
  creeps => sub {
    return ($_[0] || 0) * 100;
  },
  energy => sub {
    return int(($_[0] || 0) / 100);
  },
  gcl => sub {
    return $_[0] || $_[1]->{glc} || 0; # This fix of start typo: 'glc' instead of 'gcl'
  },
  paths => sub {
    return ($_[0] || 0) * 10;
  },
  repairs => sub {
    return int(($_[0] || 0) / 10000);
  },
  store => sub {
    return int(($_[0] || 0) / 100);
  },
};
open(STAT, ">stat_total.csv")
or die $@;
print STAT "tick\t".join("\t", sort keys %$total_keys)."\t".join("\t", sort keys %$extra)."\n";
my $run_keys = {};
my @influx_data = ();
foreach my $tick (@ticks) {
  my $data = "total tick=$tick,count=100";
  my ($version, $unixtime, $hash) = @{$info->{$tick}};
  print STAT $tick;
  foreach my $key (sort keys %$total_keys) {
    my $value = 0;
    if (!$version && exists $hash->{$key}->{cpu}) {
      $value = $hash->{$key}->{cpu};
    } elsif ($version == 1) {
      $value = ref($hash->{$key}) eq "HASH" ? $hash->{$key}->{"cpu"} : $hash->{$key};
    }
    $data .= ",$key=$value";
    $value =~ s/\./,/;
    print STAT "\t$value";
  }

  foreach my $key (sort keys %$extra) {
    my $value = defined $extra->{$key} ? $extra->{$key}->($hash->{_total}->{$key}, $hash->{_total}) : ($hash->{_total}->{$key} || 0);
    $data .= ",$key=$value";
    print STAT "\t$value";
  }

  print STAT "\n";

  if (!$version) {
    my $run = $hash->{"run"}->{"info"};
    foreach my $key (keys %$run) {
      $run_keys->{$key} = 1;
    }
  }
  $data .= " $unixtime";
  #print "data=$data\n";
  push(@influx_data, $data);
}
close(STAT);
my $res = $influx->write(\@influx_data, database => "screeps", precision => "s");
print "Influx result: ".$res."\n";

open(RUN, ">stat_run.csv")
or die $@;
print RUN "tick\t".join("\t", sort keys %$run_keys)."\n";
foreach my $tick (@ticks) {
  my ($version, $unixtime, $hash) = @{$info->{$tick}};
  next if ($version);
  my $run = $hash->{"run"}->{"info"};
  print RUN $tick;
  foreach my $key (sort keys %$run_keys) {
    my $value = exists $run->{$key} ? sprintf("%0.2f", $run->{$key}->{"cpu"} / $run->{$key}->{"sum"}) : 0;
    $value =~ s/\./,/;
    print RUN "\t$value";
  }
  print RUN "\n";
}
close(RUN);