#!/usr/bin/perl

# computer history

use strict;
use warnings;
use YAML::Tiny;
use Data::Dumper;

my $yaml = YAML::Tiny->read('./define.yaml')->[0];
my $now = '2017-00-00';

my $base_h = 40;


# apend history to corp and event
{
    foreach my $history (@{$yaml->{history}}) {

        if ($history =~ m/^(....-..-..) (Founded) (.+)$/i) {
            my ($date, $event, $corp) = ($1, $2, $3);
            my $url = undef;
            if ($corp =~ m/^(.+)\((http\S+)\)$/) {
                ($corp, $url) = ($1, $2);
            }
            $yaml->{corporation}{$corp}{wiki} = $url if defined $url;
            if ($event eq 'Founded') {
                $yaml->{corporation}{$corp}{from} = $date;
                $yaml->{corporation}{$corp}{to} = 'now';
            }
        } elsif ($history =~ m/^(....-..-..) (\S+) declared (bankruptcy)$/i) {
            my ($date, $corp, $event) = ($1, $2, $3);
            $yaml->{corporation}{$corp}{to} = $date;
            $yaml->{corporation}{$corp}{end_reason} = $event;
        } elsif ($history =~ m/^(....-..-..) (Defunct) (.+)$/i) {
            my ($date, $corp, $event) = ($1, $3, $2);
            $yaml->{corporation}{$corp}{to} = $date;
            $yaml->{corporation}{$corp}{end_reason} = $event;
        } elsif ($history =~ m/^(....-..-..) (Partnership of) (\S+) and (\S+)$/i) {
            my ($date, $event, $corp1, $corp2) = ($1, $2, $3, $4);
            $yaml->{event}{$history}{desc} = $history;
            $yaml->{event}{$history}{type} = 'partnership';
            $yaml->{event}{$history}{start_corp} = $corp2;
            $yaml->{event}{$history}{end_corp} = $corp1;
            $yaml->{event}{$history}{date} = $date;
        } elsif ($history =~ m/^(....-..-..) (.+) was (transfer) (.+) from (.+)$/i) {
            my ($date, $corp1, $event, $business, $corp2) = ($1, $2, $3, $4, $5);
            $yaml->{event}{$history}{desc} = $history;
            $yaml->{event}{$history}{type} = $business . ' ' . $event;
            $yaml->{event}{$history}{start_corp} = $corp2;
            $yaml->{event}{$history}{end_corp} = $corp1;
            $yaml->{event}{$history}{date} = $date;
        } elsif ($history =~ m/^(....-..-..) (.+) was (acquired) by (.+) from (.+)$/i) {
            my ($date, $business, $event, $corp1, $corp2) = ($1, $2, $3, $4, $5);
            $yaml->{event}{$history}{desc} = $history;
            $yaml->{event}{$history}{type} = $business . ' ' . $event;
            $yaml->{event}{$history}{start_corp} = $corp2;
            $yaml->{event}{$history}{end_corp} = $corp1;
            $yaml->{event}{$history}{date} = $date;
        } elsif ($history =~ m/^(....-..-..) (.+) was (acquired) by (.+)$/i) {
            my ($date, $corp1, $event, $corp2) = ($1, $2, $3, $4);

            # corp
            $yaml->{corporation}{$corp1}{to} = $date;
            $yaml->{corporation}{$corp1}{end_reason} = $event;

            # event
            $yaml->{event}{$history}{desc} = $history;
            $yaml->{event}{$history}{type} = $event;
            $yaml->{event}{$history}{start_corp} = $corp1;
            $yaml->{event}{$history}{end_corp} = $corp2;
            $yaml->{event}{$history}{date} = $date;
        } elsif ($history =~ m/^(....-..-..) (.+) was (invested) by (.+)$/i) {
            my ($date, $corp1, $event, $corp2) = ($1, $2, $3, $4);
            $yaml->{event}{$history}{desc} = $history;
            $yaml->{event}{$history}{type} = $event;
            $yaml->{event}{$history}{start_corp} = $corp2;
            $yaml->{event}{$history}{end_corp} = $corp1;
            $yaml->{event}{$history}{date} = $date;
        } elsif ($history =~ m/^(....-..-..) (.+) was (carved out) by (.+) as (.+)$/i) {
            # 2006-05-01 Memory div was carved out by Infineon as Qimonda
            my ($date, $div, $event, $corp1, $corp2) = ($1, $2, $3, $4, $5);
            $yaml->{event}{$history}{desc} = $history;
            $yaml->{event}{$history}{type} = $event . ' ' . $div;
            $yaml->{event}{$history}{start_corp} = $corp1;
            $yaml->{event}{$history}{end_corp} = $corp2;
            $yaml->{event}{$history}{date} = $date;
        } elsif ($history =~ m/^(....-..-..) (.+) was (merged) to (.+)$/i) {
            # 1998-09-28 Award was merged to Phoenix
            my ($date, $corp1, $event, $corp2) = ($1, $2, $3, $4);

            # corp
            $yaml->{corporation}{$corp1}{to} = $date;
            $yaml->{corporation}{$corp1}{end_reason} = $event;

            # event
            $yaml->{event}{$history}{desc} = $history;
            $yaml->{event}{$history}{type} = $event;
            $yaml->{event}{$history}{start_corp} = $corp1;
            $yaml->{event}{$history}{end_corp} = $corp2;
            $yaml->{event}{$history}{date} = $date;
        } elsif ($history =~ m/^(....-..-..) (.+) was (spun-off) from (.+)$/i) {
            # 2002-00-00 ASRock was spun-off from Asus
            my ($date, $corp1, $event, $corp2) = ($1, $2, $3, $4);

            # event
            $yaml->{event}{$history}{desc} = $history;
            $yaml->{event}{$history}{type} = $event;
            $yaml->{event}{$history}{start_corp} = $corp2;
            $yaml->{event}{$history}{end_corp} = $corp1;
            $yaml->{event}{$history}{date} = $date;
        } else {
            die "Could not parse history: $history";
        }
    }
}


# grok corp
my $max_elapsed = 0;
my $total_corp = 0;
{
    foreach my $corp (@{$yaml->{corp_seq}}) {
        my $from = $yaml->{corporation}{$corp}{from} || undef;
        my $to = $yaml->{corporation}{$corp}{to} || die "Please check corp: $corp";
        if ($to eq 'now') {
            $to = $now;
        }

        $yaml->{corporation}{$corp}{unknown_founded} = 0;
        unless (defined $from) {
            $from = minus_year($to, 10);
            $yaml->{corporation}{$corp}{unknown_founded} = 1;
        }
        $yaml->{corporation}{$corp}{from1900} = epoch1900($from);
        $yaml->{corporation}{$corp}{to1900} = epoch1900($to);

        # elapsed
        my $elapsed = epoch1900($to) - epoch1900($from);
        $yaml->{corporation}{$corp}{elapsed} = $elapsed;
        $max_elapsed = $elapsed if ($max_elapsed < $elapsed);

        # num_corps
        $total_corp++;
        $yaml->{corporation}{$corp}{num} = $total_corp;

        # corp height
        my $height = ($yaml->{corporation}{$corp}{num} + 1) * $base_h;
        $yaml->{corporation}{$corp}{height} = $height;
    }
}

# output_svg
{
    my @outputs;
    push @outputs, '<!DOCTYPE html>';
    push @outputs, '<html>';


    my $max_height = ($total_corp + 2) * $base_h;

    push @outputs, sprintf('<svg height="%s" width="%s">', $max_height, 5000); # 3960 = (2020-1900+10) * 36
    push @outputs, '';
    push @outputs, '<defs>';
    push @outputs, '<marker id="arrow" markerWidth="10" markerHeight="10" refx="10" refy="3" orient="auto" markerUnits="strokeWidth">';
    push @outputs, '<path d="M0,0 L0,6 L9,3 z" fill="#f00" />';
    push @outputs, '</marker>';
    push @outputs, '</defs>';
    push @outputs, '';
    push @outputs, '';
    push @outputs, '';

    # print year
    for (my $year = 1900; $year <= 2020; $year=$year+5) {
        my $x = ($year - 1900) * 36;
        my $y = $base_h;
        push @outputs, sprintf('<text x="%s" y="%s" fill="black">%s</text>',
            $x, $y, $year);
        push @outputs, sprintf('<line x1="%s" y1="%s" x2="%s" y2="%s" style="stroke:gray;stroke-width:1" />',
            $x, $base_h, $x, $max_height);
    }


    # define nodes
    foreach my $corp (keys %{$yaml->{corporation}}) {

        my $height = $yaml->{corporation}{$corp}{height} || die "Undefined height in corp_seq: $corp";
        my $start = $yaml->{corporation}{$corp}{from1900} * 3;
        my $end = $yaml->{corporation}{$corp}{to1900} * 3;
        my $end_reason = $yaml->{corporation}{$corp}{end_reason} || undef;
        my $end_corp = $corp;
        $end_corp .= "($end_reason)" if defined $end_reason;
        my $wiki = $yaml->{corporation}{$corp}{wiki} || undef;
        my $unknown_founded = $yaml->{corporation}{$corp}{unknown_founded} || 0;

        # corp name
        push @outputs, sprintf('<a xlink:href="%s">',
            $wiki) if defined $wiki;
        push @outputs, sprintf('<text x="%s" y="%s" fill="black">%s</text>',
            $start + 3,
            $height,
            $corp,);
        push @outputs, sprintf('<text x="%s" y="%s" fill="black">%s</text>',
            $end,
            $height,
            $end_corp,);
        push @outputs, '</a>' if defined $wiki;
        # corp line
        my $dasharray = '';
        $dasharray = 'stroke-dasharray="4 10"' if ($unknown_founded);
        push @outputs, sprintf('<line x1="%s" y1="%s" x2="%s" y2="%s" style="stroke:black;stroke-width:2" %s />',
            $start,
            $height,
            $end,
            $height,
            $dasharray,
        );


    }

    # event
    foreach my $event (keys %{$yaml->{event}}) {

        my $date = $yaml->{event}{$event}{date} || die "Please check $event";
        my $desc = $yaml->{event}{$event}{desc};
        my $type = $yaml->{event}{$event}{type};
        my $start_corp = $yaml->{event}{$event}{start_corp};
        my $end_corp = $yaml->{event}{$event}{end_corp};

        if ($date =~ m/....-..-../) {
            $date = $date;
        } elsif ($date =~ m/(.+):(start|end)/) {
            my $date_corp = $1;
            my $start_end = $2;
            my $from_to = {
                start => 'from',
                end   => 'to',
            }->{$start_end};
            $date = $yaml->{corporation}{$date_corp}{$from_to};
        }

        my $x = epoch1900($date) * 3;

        my $start_x = $x;
        my $start_y = $yaml->{corporation}{$start_corp}{height};
        my $end_x = $x;
        my $end_y = $yaml->{corporation}{$end_corp}{height};

        my $up_down;
        if (($start_y - $end_y) > 0) {
            $up_down = $base_h / 2;
        } else {
            $up_down = $base_h / 2 * '-1';
        }

        # event description
        push @outputs, sprintf('<text x="%s" y="%s" fill="red">%s</text>',
            $end_x+2,
            $end_y + $up_down,
            $type);
        push @outputs, sprintf('<line x1="%s" y1="%s" x2="%s" y2="%s" style="stroke:red;stroke-width:1" marker-end="url(#arrow)" />',
            $start_x,
            $start_y,
            $end_x,
            $end_y,);
        push @outputs, sprintf('<circle cx="%s" cy="%s" r="3" fill="red" />',
            $start_x,
            $start_y,
            );
        die $event unless defined $start_y;
    }



    push @outputs, '';
    push @outputs, '</svg>';
    push @outputs, '</body>';
    push @outputs, '</html>';


    _write_file('history.html', join("\n", @outputs)."\n");
}


exit 0;

sub epoch1900 {
    my $date = shift;

    if ($date =~ m/(....)-(..)-(..)/) {
        my ($y, $m, $d) = ($1, $2, $3);
        $y = 1900 if ($y < 1900); # truncate
        my $epoch = ($y-1900)*12 + $m;
        return $epoch;
    } else {
        return 0;
    }
}

sub minus_year {
    my ($date, $year) = @_;

    if ($date =~ m/^(....)-(..)-(..)$/) {
        return join('-', ($1-$year,$2,$3));
    }
    return $date;
}

sub _write_file {
    my $file = shift;
    my $text = shift;

    my $fh = IO::File->new("> $file");
    if (defined $fh) {
        print $fh "$text";
        undef $fh;
    }
}


# vim: tabstop=4 shiftwidth=4 expandtab
