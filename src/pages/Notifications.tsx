import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { timeAgo } from "@/lib/format";

interface Notif {
  id: string;
  type: string;
  payload: Record<string, unknown> | null;
  is_read: boolean;
  created_at: string;
}

export default function Notifications() {
  const { user } = useAuth();
  const [items, setItems] = useState<Notif[] | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("notifications")
      .select("id, type, payload, is_read, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => setItems((data ?? []) as Notif[]));
  }, [user]);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-semibold">Notifications</h1>
      {items === null ? (
        <Skeleton className="h-20 rounded-2xl" />
      ) : items.length === 0 ? (
        <EmptyState icon={Bell} title="You're all caught up" description="When people follow, comment, or react, it shows up here." />
      ) : (
        <ul className="space-y-2">
          {items.map((n) => (
            <li key={n.id} className="surface-card p-3 flex justify-between items-center">
              <span className="text-sm">{n.type}</span>
              <span className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}