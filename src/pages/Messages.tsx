import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Send, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, isToday, isYesterday } from 'date-fns';

interface Contact {
  id: string;
  full_name: string;
  avatar_url: string | null;
  role: string;
  lastMessage?: string;
  lastMessageAt?: string;
  unreadCount: number;
}

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  created_at: string;
  read_at: string | null;
}

function formatTime(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, 'HH:mm');
  if (isYesterday(d)) return 'Yesterday';
  return format(d, 'dd/MM');
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function Messages() {
  const { user, currentOrg, currentRole } = useAuth();
  const queryClient = useQueryClient();
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Get contacts: coaches see their athletes, athletes see their coaches
  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ['message-contacts', user?.id, currentOrg?.id],
    queryFn: async () => {
      if (!user || !currentOrg) return [];

      const isCoach = currentRole === 'coach' || currentRole === 'master_admin';

      const { data: assignments } = await supabase
        .from('coach_athlete_assignments')
        .select('coach_id, athlete_id')
        .eq('organization_id', currentOrg.id)
        .or(isCoach ? `coach_id.eq.${user.id}` : `athlete_id.eq.${user.id}`);

      if (!assignments?.length) return [];

      const contactIds = assignments.map(a => isCoach ? a.athlete_id : a.coach_id);
      const uniqueIds = [...new Set(contactIds)];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', uniqueIds);

      if (!profiles) return [];

      // Get last message + unread count per contact
      const { data: messages } = await supabase
        .from('direct_messages')
        .select('*')
        .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      const contactList: Contact[] = profiles.map(p => {
        const contactMessages = (messages || []).filter(
          m => m.sender_id === p.id || m.recipient_id === p.id
        );
        const last = contactMessages[0];
        const unread = contactMessages.filter(
          m => m.sender_id === p.id && !m.read_at
        ).length;

        return {
          id: p.id,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          role: isCoach ? 'athlete' : 'coach',
          lastMessage: last?.content,
          lastMessageAt: last?.created_at,
          unreadCount: unread,
        };
      });

      // Sort by last message time
      contactList.sort((a, b) => {
        if (!a.lastMessageAt) return 1;
        if (!b.lastMessageAt) return -1;
        return new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime();
      });

      return contactList;
    },
    enabled: !!user && !!currentOrg,
  });

  // Get conversation messages
  const { data: messages = [] } = useQuery<Message[]>({
    queryKey: ['direct-messages', user?.id, activeContactId],
    queryFn: async () => {
      if (!user || !activeContactId) return [];
      const { data } = await supabase
        .from('direct_messages')
        .select('*')
        .or(
          `and(sender_id.eq.${user.id},recipient_id.eq.${activeContactId}),and(sender_id.eq.${activeContactId},recipient_id.eq.${user.id})`
        )
        .order('created_at', { ascending: true });
      return (data as Message[]) || [];
    },
    enabled: !!user && !!activeContactId,
  });

  // Mark messages as read
  useEffect(() => {
    if (!user || !activeContactId || !messages.length) return;
    const unread = messages.filter(m => m.sender_id === activeContactId && !m.read_at);
    if (unread.length > 0) {
      supabase
        .from('direct_messages')
        .update({ read_at: new Date().toISOString() })
        .in('id', unread.map(m => m.id))
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['message-contacts'] });
        });
    }
  }, [messages, activeContactId, user]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('direct-messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'direct_messages',
      }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === user.id || msg.recipient_id === user.id) {
          queryClient.invalidateQueries({ queryKey: ['direct-messages'] });
          queryClient.invalidateQueries({ queryKey: ['message-contacts'] });
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!user || !activeContactId) throw new Error('Not ready');
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: user.id,
        recipient_id: activeContactId,
        content,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft('');
      queryClient.invalidateQueries({ queryKey: ['direct-messages'] });
      queryClient.invalidateQueries({ queryKey: ['message-contacts'] });
    },
  });

  const handleSend = () => {
    const text = draft.trim();
    if (!text) return;
    sendMutation.mutate(text);
  };

  const activeContact = contacts.find(c => c.id === activeContactId);

  // Group messages by date
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = '';
    for (const msg of messages) {
      const d = format(new Date(msg.created_at), 'yyyy-MM-dd');
      if (d !== currentDate) {
        currentDate = d;
        groups.push({ date: d, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    }
    return groups;
  }, [messages]);

  function formatDateLabel(dateStr: string) {
    const d = new Date(dateStr);
    if (isToday(d)) return 'Today';
    if (isYesterday(d)) return 'Yesterday';
    return format(d, 'EEEE, d MMM');
  }

  // Chat view
  if (activeContactId && activeContact) {
    return (
      <div className="flex flex-col h-[calc(100vh-5rem)] max-w-lg mx-auto">
        {/* Chat header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b bg-card">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveContactId(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-8 w-8">
            <AvatarFallback className="text-xs bg-primary/10 text-primary">
              {initials(activeContact.full_name)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-semibold">{activeContact.full_name}</p>
            <p className="text-[10px] text-muted-foreground capitalize">{activeContact.role}</p>
          </div>
        </div>

        {/* Messages area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
          {messages.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">
              No messages yet. Say hello! 👋
            </p>
          )}
          {groupedMessages.map(group => (
            <div key={group.date}>
              <div className="flex justify-center my-2">
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {formatDateLabel(group.date)}
                </span>
              </div>
              <div className="space-y-1.5">
                {group.messages.map(msg => {
                  const isMine = msg.sender_id === user?.id;
                  return (
                    <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                      <div className={cn(
                        'max-w-[80%] px-3 py-2 rounded-2xl text-sm',
                        isMine
                          ? 'bg-primary text-primary-foreground rounded-br-md'
                          : 'bg-muted text-foreground rounded-bl-md'
                      )}>
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <p className={cn(
                          'text-[10px] mt-0.5',
                          isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'
                        )}>
                          {format(new Date(msg.created_at), 'HH:mm')}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Input bar */}
        <div className="px-4 py-3 border-t bg-card">
          <form
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex items-center gap-2"
          >
            <Input
              placeholder="Type a message..."
              value={draft}
              onChange={e => setDraft(e.target.value)}
              className="flex-1"
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim() || sendMutation.isPending}
              className="gradient-hyrox h-9 w-9"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    );
  }

  // Contact list view
  return (
    <div className="px-4 py-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-display font-bold">Messages</h1>

      {contacts.length === 0 ? (
        <Card className="p-8 text-center space-y-3">
          <MessageSquare className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="font-display font-bold">No Conversations</p>
          <p className="text-sm text-muted-foreground">
            {currentRole === 'athlete'
              ? 'You need to be assigned to a coach to start messaging.'
              : 'Assign athletes to start messaging them.'}
          </p>
        </Card>
      ) : (
        <div className="space-y-1">
          {contacts.map(c => (
            <button
              key={c.id}
              onClick={() => setActiveContactId(c.id)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-muted/50 transition-colors text-left"
            >
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm">
                  {initials(c.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold truncate">{c.full_name}</p>
                  {c.lastMessageAt && (
                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                      {formatTime(c.lastMessageAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground truncate">
                    {c.lastMessage || 'Start a conversation'}
                  </p>
                  {c.unreadCount > 0 && (
                    <Badge variant="default" className="ml-2 h-5 min-w-[20px] text-[10px] gradient-hyrox border-0">
                      {c.unreadCount}
                    </Badge>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
