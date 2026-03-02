import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Send, Bot, User, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/hyrox-ai-coach`;

const suggestions = [
  "What's a good HYROX race strategy?",
  "Can I swap today's run for a bike?",
  "How should I pace the SkiErg station?",
  "Suggest a recovery session",
];

export default function AIChat() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: "Hey! I'm your **HYROX AI Coach**. Ask me about training plans, race strategy, session modifications, or performance insights. 🏋️" },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: 'user', content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput('');
    setIsLoading(true);

    let assistantSoFar = '';

    try {
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages }),
      });

      if (resp.status === 429) {
        toast.error('Rate limit exceeded. Please wait a moment.');
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast.error('AI credits exhausted. Add credits in Settings → Workspace → Usage.');
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error('Failed to start stream');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let streamDone = false;

      const upsertAssistant = (chunk: string) => {
        assistantSoFar += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && prev.length > allMessages.length) {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantSoFar } : m));
          }
          return [...prev, { role: 'assistant', content: assistantSoFar }];
        });
      };

      while (!streamDone) {
        const { done, value } = await reader.read();
        if (done) break;
        textBuffer += decoder.decode(value, { stream: true });

        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          let line = textBuffer.slice(0, newlineIndex);
          textBuffer = textBuffer.slice(newlineIndex + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (line.startsWith(':') || line.trim() === '') continue;
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') { streamDone = true; break; }
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {
            textBuffer = line + '\n' + textBuffer;
            break;
          }
        }
      }

      // Final flush
      if (textBuffer.trim()) {
        for (let raw of textBuffer.split('\n')) {
          if (!raw) continue;
          if (raw.endsWith('\r')) raw = raw.slice(0, -1);
          if (raw.startsWith(':') || raw.trim() === '') continue;
          if (!raw.startsWith('data: ')) continue;
          const jsonStr = raw.slice(6).trim();
          if (jsonStr === '[DONE]') continue;
          try {
            const parsed = JSON.parse(jsonStr);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsertAssistant(content);
          } catch {}
        }
      }
    } catch (e) {
      console.error(e);
      toast.error('Failed to get AI response');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-lg mx-auto">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl gradient-hyrox flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-display font-bold">AI Coach</h1>
            <p className="text-[10px] text-muted-foreground">HYROX-specific training intelligence</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {msg.role === 'assistant' && (
                <div className="h-6 w-6 rounded-lg gradient-hyrox flex items-center justify-center flex-shrink-0 mt-1">
                  <Bot className="h-3 w-3 text-primary-foreground" />
                </div>
              )}
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground rounded-br-md'
                  : 'bg-muted rounded-bl-md'
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
              {msg.role === 'user' && (
                <div className="h-6 w-6 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="h-3 w-3 text-secondary-foreground" />
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-2">
            <div className="h-6 w-6 rounded-lg gradient-hyrox flex items-center justify-center flex-shrink-0">
              <Bot className="h-3 w-3 text-primary-foreground" />
            </div>
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </motion.div>
        )}

        {/* Suggestions */}
        {messages.length <= 1 && (
          <div className="flex flex-wrap gap-2 mt-4">
            {suggestions.map(s => (
              <Button key={s} variant="outline" size="sm" className="text-xs rounded-full" onClick={() => sendMessage(s)}>
                {s}
              </Button>
            ))}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(input); }} className="flex gap-2">
          <Input
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask your AI coach…"
            className="rounded-full"
            disabled={isLoading}
          />
          <Button type="submit" size="icon" className="rounded-full gradient-hyrox flex-shrink-0" disabled={!input.trim() || isLoading}>
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
