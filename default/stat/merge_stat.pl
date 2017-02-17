#!/usr/bin/perl -w

use strict;

my @files = glob('stat_cpu_*.csv');
my $keys = {};
my $hash = {};
foreach my $file (sort @files) {
    if(my ($mode) = $file =~ /stat_cpu_(\w+)\.\d+\.csv/ ) {
        print "$file: $mode\n";
        open(F, $file)
        or die $@;

        my $head = 0;
        my @keys = ();
        while (my $str = <F>) {
            chomp($str);
            $str =~ s/\./,/g;
            if (!$head) {
                $head = 1;
                @keys = split(/\t/, $str);
                foreach my $key (@keys) {
                    $keys->{$mode}->{$key} = 1;
                }
            } else {
                my @values = split(/\t/, $str);
                my $elem = {};
                foreach my $key (@keys) {
                    $elem->{$key} = shift @values;
                }
                push( @{$hash->{$mode}}, $elem);
            }
        }
    }
}

foreach my $mode (keys %$keys) {
    print "mode: $mode; rows: ".scalar(@{$hash->{$mode}})."\n";
    open(F, ">stat_$mode.csv")
    or die $@;

    print F join("\t", sort keys %{$keys->{$mode}})."\n";

    foreach my $elem (@{$hash->{$mode}}) {
        my @values = ();
        foreach my $key (sort keys %{$keys->{$mode}}) {
            push(@values, $elem->{$key} || 0);
        }
        print F join("\t", @values)."\n";
    }

    close(F);
}