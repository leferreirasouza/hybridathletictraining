
-- Direct messages table for coach-athlete communication
CREATE TABLE public.direct_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  content text NOT NULL,
  read_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages they sent or received
CREATE POLICY "Users view own messages"
  ON public.direct_messages FOR SELECT
  USING (sender_id = auth.uid() OR recipient_id = auth.uid());

-- Users can insert messages where they are the sender
CREATE POLICY "Users send messages"
  ON public.direct_messages FOR INSERT
  WITH CHECK (sender_id = auth.uid());

-- Recipients can update (mark as read)
CREATE POLICY "Recipients update messages"
  ON public.direct_messages FOR UPDATE
  USING (recipient_id = auth.uid());

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;
