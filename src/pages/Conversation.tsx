import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Send, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { initialsOf, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  media_url: string | null;
  created_at: string;
  is_deleted: boolean;
}

interface Other {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

const msgSchema = z.object({ content: z.string().trim().min(1).max(4000) });

export default function Conversation() {
  const { id: conversationId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [other, setOther] = useState<Other | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(async () => {
    if (!user || !conversationId) return;
    await supabase
      .from("conversation_participants")
      .update({ last_read_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id);
  }, [user, conversationId]);

  const load = useCallback(async () => {
    if (!conversationId || !user) return;
    // Verify membership + fetch other participant
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("user_id, profile:profiles!conversation_participants_user_id_fkey(id, username, display_name, avatar_url)")
      .eq("conversation_id", conversationId);
    if (!parts || parts.length === 0) {
      navigate("/messages");
      return;
    }
    const me = parts.find((p) => p.user_id === user.id);
    if (!me) {
      toast({ title: "Not a participant", variant: "destructive" });
      navigate("/messages");
      return;
    }
    const o = parts.find((p) => p.user_id !== user.id);
    setOther(((o as unknown as { profile: Other | null })?.profile) ?? null);

    const { data: msgs } = await supabase
      .from("messages")
      .select("id, conversation_id, sender_id, content, media_url, created_at, is_deleted")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: true })
      .limit(200);
    setMessages((msgs ?? []) as Message[]);
    markRead();
  }, [conversationId, user, navigate, markRead]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!conversationId || !user) return;
    const ch = supabase
      .channel(`conv-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => {
            const msg = payload.new as Message;
            if (!prev) return [msg];
            if (prev.some((m) => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          markRead();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) =>
            prev ? prev.map((m) => (m.id === (payload.new as Message).id ? (payload.new as Message) : m)) : prev
          );
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [conversationId, user, markRead]);

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  const send = async () => {
    const parsed = msgSchema.safeParse({ content: draft });
    if (!parsed.success || !user || !conversationId) return;
    setSending(true);
    const { error } = await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: user.id,
      content: parsed.data.content,
    });
    setSending(false);
    if (error) {
      toast({ title: "Could not send", description: error.message, variant: "destructive" });
      return;
    }
    setDraft("");
  };

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-9rem)] md:h-[calc(100vh-7rem)] flex flex-col surface-card overflow-hidden">
      <header className="px-3 py-2.5 border-b border-border flex items-center gap-2 bg-card">
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => navigate("/messages")} aria-label="Back">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        {other ? (
          <Link to={`/u/${other.username}`} className="flex items-center gap-2 hover:underline">
            <Avatar className="h-8 w-8">
              <AvatarImage src={other.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs">
                {initialsOf(other.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="leading-tight">
              <p className="text-sm font-semibold">{other.display_name}</p>
              <p className="text-[10px] text-muted-foreground">@{other.username}</p>
            </div>
          </Link>
        ) : (
          <span className="text-sm">Conversation</span>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages === null ? (
          <p className="text-xs text-muted-foreground text-center">Loading…</p>
        ) : messages.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-8">No messages yet. Say hi 👋</p>
        ) : (
          messages.map((m, i) => {
            const mine = m.sender_id === user?.id;
            const prev = messages[i - 1];
            const showTime = !prev || new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() > 5 * 60 * 1000;
            return (
              <div key={m.id}>
                {showTime && (
                  <p className="text-[10px] text-muted-foreground text-center my-2">{timeAgo(m.created_at)}</p>
                )}
                <div className={cn("flex", mine ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[78%] px-3.5 py-2 rounded-2xl text-sm whitespace-pre-wrap break-words",
                      mine
                        ? "bg-gradient-brand text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {m.is_deleted ? <em className="opacity-70">Message deleted</em> : m.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="border-t border-border p-2 flex items-end gap-2 bg-card">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a message…"
          rows={1}
          maxLength={4000}
          className="resize-none rounded-2xl bg-muted/60 border-0 text-sm focus-visible:ring-1"
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <Button
          onClick={send}
          disabled={sending || !draft.trim()}
          size="icon"
          className="rounded-full bg-gradient-brand text-primary-foreground shrink-0"
          aria-label="Send"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}