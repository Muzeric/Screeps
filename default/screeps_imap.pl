#!/usr/bin/perl -w

use strict;
use Term::ReadKey;
use Mail::IMAPClient;
use Data::Dumper;
use Encode;

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

#$imap->login()
#or print STDERR "login: ".$imap->LastError."\n"
#and die;
print "Login\n";

my $messages = {};
foreach my $folder ('Inbox') {
	$imap->select($folder)
	or print STDERR "select '$folder': ".$imap->LastError."\n"
	and die;
	print "Selecting '$folder'\n";

	#my $hash = $imap->fetch_hash("BODY[HEADER.FIELDS (Subject)]");
	#print "Got ".scalar(keys %$hash)."\n";

	my @msgids = $imap->search('SUBJECT screeps')
	or print STDERR "search in '$folder': ".$imap->LastError."\n"
	and die;
	print "Searching in '$folder'\n";

	#my @msgs = $imap->Results
	#or print STDERR "FetchHeaders: ".$imap->LastError."\n"
	#and die;
	#print "Fetching\n";

	my @msgs = $imap->fetch_hash([@msgids], "ENVELOPE");
	print Dumper(@msgs);
exit;

	print "Got ".scalar(@msgs)." emailes\n";
	foreach my $msg (@msgs) {
		my $subj = $imap->fetch_hash($msg,"ENVELOPE")
		or print STDERR "getting header: ".$imap->LastError."\n";
		print "$msg: ".Dumper($subj)."\n";
	}
	#print Dumper(@msgs);
exit;
}
=cut
#	my $content = $imap->fetch_hash("FLAGS","BODY.PEEK[HEADER.FIELDS (Subject Message-id UID)]");
	my $content = $imap->fetch_hash("ENVELOPE","FLAGS","INTERNALDATE");
print Dumper($content);
exit;
	
	while (my ($id,$msg) = each %$content) {
		my $header = $imap->parse_headers($id,"Subject","Message-ID","UID");
#print Dumper($header);
#exit;
		if (grep {m/Seen/} $msg->{FLAGS}) {
			$messages->{$header->{'Message-ID'}->[0]}->{seen}++;
		} else {
			$messages->{$header->{'Message-ID'}->[0]}->{unseen}++;
			$messages->{$header->{'Message-ID'}->[0]}->{folders}->{$folder} = 1;
			$messages->{$header->{'Message-ID'}->[0]}->{subject} = encode_utf8($header->{Subject}->[0]);
		}
	}

	print scalar(keys %$content)." messages\n";
}
print "\n";

          bless( {
                   'message_id' => '<27932516.1184761505729.JavaMail.root@turnshadow>',
                   'date' => 'Wed, 18 Jul 2007 16:25:05 +0400 (MSD)',
                   'encoded_size' => '1953',
                   'to' => [
                             bless( {
                                      'at_domain_list' => undef,
                                      'name' => undef,
                                      'mailbox' => 'saint',
                                      'host' => 'yandex-team.ru'
                                    }, 'Net::IMAP::Client::MsgAddress' )
                           ],
                   'subtype' => 'plain',
                   'cc' => undef,
                   'from' => [
                               bless( {
                                        'at_domain_list' => undef,
                                        'name' => '=?UTF-8?B?0JHQtdC70Y/QtdCyINCR0L7RgNC40YEgKEpJUkEp?=',
                                        'mailbox' => 'jira',
                                        'host' => 'yandex-team.ru'
                                      }, 'Net::IMAP::Client::MsgAddress' )
                             ],
                   'uid' => '306',
                   'flags' => [
                                '\\Seen'
                              ],
                   'seq_id' => '306',
                   'rfc822_size' => '3978',
                   'subject' => '=?UTF-8?B?W0pJUkFdIENyZWF0ZWQ6IChZ?= =?UTF-8?B?QUJTLTY0Nykg0J7Qv9GA0LXQtNC10LvQtdC90Lg=?= =?UTF-8?B?0LUg0LrQvtC70LjRh9C10YHRgtCy0LAg0L/Rg9GC0LXQuSA=?= =?UTF-8?B?0LTQu9GPINC/0L7QuNGB0LrQvtCy0L7Qs9C+INC60L7QtNCw?=',
                   'in_reply_to' => undef,
                   'description' => undef,
                   'transfer_encoding' => 'QUOTED-PRINTABLE',
                   'internaldate' => '18-Jul-2007 16:25:15 +0400',
                   'parameters' => {
                                     'charset' => 'UTF-8'
                                   },
                   'bcc' => undef,
                   'sender' => [
                                 bless( {
                                          'at_domain_list' => undef,
                                          'name' => '=?UTF-8?B?0JHQtdC70Y/QtdCyINCR0L7RgNC40YEgKEpJUkEp?=',
                                          'mailbox' => 'jira',
                                          'host' => 'yandex-team.ru'
                                        }, 'Net::IMAP::Client::MsgAddress' )
                               ],
                   'reply_to' => [
                                   bless( {
                                            'at_domain_list' => undef,
                                            'name' => '=?UTF-8?B?0JHQtdC70Y/QtdCyINCR0L7RgNC40YEgKEpJUkEp?=',
                                            'mailbox' => 'jira',
                                            'host' => 'yandex-team.ru'
                                          }, 'Net::IMAP::Client::MsgAddress' )
                                 ],
                   'cid' => undef,
                   'type' => 'text'
                 }, 'Net::IMAP::Client::MsgSummary' ),

=cut

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
