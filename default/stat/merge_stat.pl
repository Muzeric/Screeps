#!/usr/bin/perl -w

use strict;

my $limit = shift @ARGV || 0;
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
            if (!$head) {
                $head = 1;
                @keys = split(/\t/, $str);
                foreach my $key (@keys) {
                    $keys->{$mode}->{$key} = 1;
                }
            } else {
                $str =~ s/\./,/g;
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
    open(F, ">stat_$mode.csv")
    or die $@;

    print F join("\t", sort sort_keys keys %{$keys->{$mode}})."\n";
    my @elems = (sort {$a->{tick} <=> $b->{tick}} @{$hash->{$mode}});
    if ($limit) {
        @elems = splice(@elems, -$limit);
    }
    print "mode: $mode; rows: ".scalar(@{$hash->{$mode}})." -> ".scalar(@elems)."\n";
    foreach my $elem (@elems) {
        my @values = ();
        foreach my $key (sort sort_keys keys %{$keys->{$mode}}) {
            push(@values, $elem->{$key} || 0);
        }
        print F join("\t", @values)."\n";
    }

    close(F);
}

sub sort_keys {
    if ($a eq 'tick' && $b ne 'tick') {
        return -1;
    } elsif ($b eq 'tick' && $a ne 'tick') {
        return 1;
    } else {
        return $a cmp $b;
    }
}