import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, Heart, MessageCircle, UserPlus, UserCheck, MessageSquare, CheckCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { timeAgo, initialsOf } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Notif {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
  actor_id: string | null;
  actor: { username: string; display_name: string; avatar_url: string | null } | null;
}

const ICON: Record<string, typeof Bell> = {
  post_reaction: Heart,
  post_comment: MessageCircle,
  comment_reply: MessageCircle,
  follow: UserPlus,
  friend_request: UserPlus,
  friend_accept: UserCheck,
  message: MessageSquare,
};

const VERB: Record<string, string> = {
  post_reaction: "reacted to your post",
  post_comment: "commented on your post",
  comment_reply: "replied to your comment",
  follow: "started following you",
  friend_request: "sent you a friend request",
  friend_accept: "accepted your friend request",
  message: "sent you a message",
};

function linkFor(n: Notif): string {
  if (n.type === "message" && n.payload?.conversation_id) return `/messages/${n.payload.conversation_id}`;
  if (n.type === "friend_request" || n.type === "friend_accept") return `/friends`;
  if (n.type === "follow" && n.actor) return `/u/${n.actor.username}`;
  if (n.actor) return `/u/${n.actor.username}`;
  return "/feed";
}

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("notifications")
      .select(
        "id, type, payload, is_read, created_at, actor_id, actor:profiles!notifications_actor_id_fkey(username, display_name, avatar_url)"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as unknown as Notif[]);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Mark all as read on mount
  useEffect(() => {
    if (!user) return;
    supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false).then(() => {});
  }, [user]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifs-page-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Notifications</h1>
        {items && items.some((i) => !i.is_read) && (
          <Button variant="ghost" size="sm" onClick={markAllRead} className="rounded-full">
            <CheckCheck className="h-4 w-4 mr-1" /> Mark all read
          </Button>
        )}
      </header>
      {items === null ? (
        <Skeleton className="h-20 rounded-2xl" />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" description="When people follow, react, comment, or message you, it'll show up here." />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => {
            const Icon = ICON[n.type] ?? Bell;
            return (
              <li key={n.id}>
                <Link
                  to={linkFor(n)}
                  className={cn(
                    "surface-card p-3 flex items-center gap-3 hover:shadow-elevated transition",
                    !n.is_read && "ring-1 ring-primary/30"
                  )}
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={n.actor?.avatar_url ?? undefined} />
                      <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs">
                        {initialsOf(n.actor?.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Icon className="h-3 w-3" />
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold">{n.actor?.display_name ?? "Someone"}</span>{" "}
                      <span className="text-muted-foreground">{VERB[n.type] ?? n.type}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
                  </div>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}