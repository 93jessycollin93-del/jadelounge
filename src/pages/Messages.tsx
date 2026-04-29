import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { initialsOf, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

interface ConvRow {
  conversation_id: string;
  last_read_at: string | null;
  conversations: {
    id: string;
    is_group: boolean;
    title: string | null;
    last_message_at: string;
  } | null;
}

interface OtherProfile {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
}

interface LastMsg {
  conversation_id: string;
  content: string | null;
  media_url: string | null;
  sender_id: string;
  created_at: string;
}

export default function Messages() {
  const { user } = useAuth();
  const [rows, setRows] = useState<
    | {
        id: string;
        title: string;
        avatar: string | null;
        last_message_at: string;
        last_read_at: string | null;
        preview: string;
        otherUsername?: string;
      }[]
    | null
  >(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: parts } = await supabase
      .from("conversation_participants")
      .select("conversation_id, last_read_at, conversations:conversation_id(id, is_group, title, last_message_at)")
      .eq("user_id", user.id);

    const list = (parts ?? []) as unknown as ConvRow[];
    const convIds = list.map((p) => p.conversation_id);
    if (convIds.length === 0) {
      setRows([]);
      return;
    }

    // For 1:1: fetch the other participant
    const { data: others } = await supabase
      .from("conversation_participants")
      .select("conversation_id, user_id, profile:profiles!conversation_participants_user_id_fkey(id, username, display_name, avatar_url)")
      .in("conversation_id", convIds)
      .neq("user_id", user.id);

    const otherByConv = new Map<string, OtherProfile>();
    (others ?? []).forEach((o) => {
      const p = (o as unknown as { profile: OtherProfile | null }).profile;
      if (p) otherByConv.set(o.conversation_id as string, p);
    });

    // Last message preview per conversation (take latest)
    const { data: msgs } = await supabase
      .from("messages")
      .select("conversation_id, content, media_url, sender_id, created_at")
      .in("conversation_id", convIds)
      .order("created_at", { ascending: false })
      .limit(200);
    const lastByConv = new Map<string, LastMsg>();
    (msgs ?? []).forEach((m) => {
      const cid = m.conversation_id as string;
      if (!lastByConv.has(cid)) lastByConv.set(cid, m as LastMsg);
    });

    const out = list
      .filter((p) => p.conversations)
      .map((p) => {
        const conv = p.conversations!;
        const other = otherByConv.get(p.conversation_id);
        const last = lastByConv.get(p.conversation_id);
        const preview = last
          ? last.media_url && !last.content
            ? "📎 Media"
            : last.content ?? ""
          : "No messages yet";
        return {
          id: conv.id,
          title: conv.is_group ? conv.title ?? "Group chat" : other?.display_name ?? "Conversation",
          avatar: conv.is_group ? null : other?.avatar_url ?? null,
          last_message_at: conv.last_message_at,
          last_read_at: p.last_read_at,
          preview,
          otherUsername: other?.username,
        };
      })
      .sort((a, b) => new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime());

    setRows(out);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // realtime updates
  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`messages-list-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user, load]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-semibold">Messages</h1>
      {rows === null ? (
        <Skeleton className="h-20 rounded-2xl" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={MessageCircle}
          title="No conversations yet"
          description="Open someone's profile and tap Message to start a real-time chat."
        />
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const unread =
              !r.last_read_at ||
              new Date(r.last_message_at).getTime() > new Date(r.last_read_at).getTime();
            return (
              <li key={r.id}>
                <Link
                  to={`/messages/${r.id}`}
                  className={cn(
                    "surface-card p-3 flex items-center gap-3 hover:shadow-elevated transition",
                    unread && "ring-1 ring-primary/30"
                  )}
                >
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={r.avatar ?? undefined} />
                    <AvatarFallback className="bg-gradient-brand text-primary-foreground">
                      {initialsOf(r.title)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("text-sm truncate", unread ? "font-semibold" : "font-medium")}>{r.title}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(r.last_message_at)}</span>
                    </div>
                    <p className={cn("text-xs truncate", unread ? "text-foreground" : "text-muted-foreground")}>
                      {r.preview}
                    </p>
                  </div>
                  {unread && <span className="h-2.5 w-2.5 rounded-full bg-primary shrink-0" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}