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
my $total_keys = {};
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
      $total_keys->{$key} = 1;
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
print STAT "tick\t".join("\t", sort keys %$total_keys)."\n";
my $room_keys = {};
foreach my $tick (@ticks) {
  my $hash = $info->{$tick};
  print STAT $tick;
  foreach my $key (sort keys %$total_keys) {
    my $sum = 0;
    foreach my $k (keys %{$hash->{$key}}) {
      next if $k eq "cpu";
      $room_keys->{$k} = 1;
      next if $k eq "pickup";
      $sum += $hash->{$key}->{$k};
    }
    $sum =~ s/\./,/;
    print STAT "\t$sum";
  }
  print STAT "\n";
}
print STAT "\n";

foreach my $room (sort keys %$total_keys) {
  print STAT "$room\n";
  print STAT "tick\t".join("\t",sort keys %{$room_keys})."\n";
  my $sum = {};
  foreach my $tick (@ticks) {
    print STAT $tick;
    my $hash = $info->{$tick}->{$room};
    foreach my $k (sort keys %{$room_keys}) {
      my $v = $hash->{$k} || 0;
      #$sum->{$k} += $hash->{$k} || 0;
      #my $v = $sum->{$k};
      $v =~ s/\./,/;
      print STAT "\t$v";
    }
    print STAT "\n";
  }
  print STAT "\n";
}
close(STAT);
