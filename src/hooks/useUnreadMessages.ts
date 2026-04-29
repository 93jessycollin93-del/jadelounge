import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Counts conversations with at least one message newer than the user's last_read_at.
 */
export function useUnreadMessages() {
  const { user } = useAuth();
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!user) {
      setCount(0);
      return;
    }
    let mounted = true;
    const refresh = async () => {
      const { data: parts } = await supabase
        .from("conversation_participants")
        .select("conversation_id, last_read_at, conversations:conversation_id(last_message_at)")
        .eq("user_id", user.id);
      if (!mounted) return;
      const unread = (parts ?? []).filter((p) => {
        const c = (p as unknown as { conversations: { last_message_at: string } | null }).conversations;
        if (!c) return false;
        if (!p.last_read_at) return true;
        return new Date(c.last_message_at).getTime() > new Date(p.last_read_at as string).getTime();
      }).length;
      setCount(unread);
    };
    refresh();

    const channel = supabase
      .channel(`unread-msgs-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => refresh())
      .on("postgres_changes", { event: "*", schema: "public", table: "conversation_participants", filter: `user_id=eq.${user.id}` }, () => refresh())
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [user]);

  return count;
}