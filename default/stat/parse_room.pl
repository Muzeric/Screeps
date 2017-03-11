#!/usr/bin/perl -w

use strict;
use Data::Dumper;
use Encode;
use utf8;

use POSIX;
#use locale; 
#setlocale LC_CTYPE, 'en_US.UTF-8';

my $limit = shift @ARGV || 0;
binmode STDOUT, ':utf8';
$| = 1;

my @files = glob('mail_room/m*.msg');
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
my $rooms = {};
my $room_keys = {};
foreach my $file (@files) {
  open(F, $file)
  or die $@;

  my $tick = <F>;
  chomp($tick);
  unless ($tick =~ /^\d+$/) {
    print STDERR "tick is not a number in $file: $tick\n";
    next;
  }
  my $jshash = <F>;
  chomp($jshash);

  if (my $hash = eval($jshash) ) {
    $info->{$tick} = $hash;
    foreach my $key (keys %$hash) {
      next if ($key =~ /miner|harvester/);
      $rooms->{$key} = 1;
      foreach my $k (keys %{$hash->{$key}}) {
        $room_keys->{$k} = 1;
      }
    }
  } else {
    print "can't eval ($@): ".substr($jshash, 0, 50)." ... ".substr($jshash, -50)."\n";
  }
  $count++;
  close(F);
}

my @ticks = sort {$a <=> $b} keys %$info;
if ($limit) {
  @ticks = splice(@ticks, -$limit);
}

open(STAT, ">stat_room.csv")
or die $@;
print STAT "tick\troom\teff\t".join("\t", sort keys %$room_keys)."\n";
my $sum = {};
my $tc = 1;
foreach my $tick (@ticks) {
  my $hash = $info->{$tick};
  foreach my $room (keys %$rooms) {
    foreach my $k (keys %$room_keys) {
      $sum->{$room}->{$k} += $hash->{$room}->{$k};
    }
  }

  if ($tc % 10 == 0) {
    foreach my $room (sort keys %$rooms) {
      my $s = $sum->{$room};
      my $got = $s->{harvest} + $s->{pickup};
      my $spent = $s->{create} + $s->{repair} + $s->{upgrade} + $s->{build} + $s->{dead};
      next if ($got == 0 && $spent == 0);
      my $eff = $got > 0 ? int(($spent + $got) * 100 / $got) : -100;
      print STAT "$tick\t$room\t$eff";
      foreach my $k (sort keys %$room_keys) {
        my $v = $s->{$k};
        $v =~ s/\./,/;
        print STAT "\t$v";
      }
      print STAT "\n";
    }
    $sum = {};
  }
  $tc++;
}
print STAT "\n";
close(STAT);