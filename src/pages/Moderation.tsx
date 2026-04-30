import { formatDbError } from "@/lib/errors";
import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/hooks/use-toast";
import { timeAgo } from "@/lib/format";

interface Report {
  id: string;
  reporter_id: string;
  target_type: string;
  target_id: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function Moderation() {
  const { user } = useAuth();
  const [items, setItems] = useState<Report[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("reports")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setItems((data ?? []) as Report[]);
  }, []);

  useEffect(() => { load(); }, [load]);

  const resolve = async (id: string, status: "resolved" | "dismissed") => {
    if (!user) return;
    const { error } = await supabase
      .from("reports")
      .update({ status, resolved_by: user.id, resolved_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      toast({ title: "Failed", description: formatDbError(error), variant: "destructive" });
      return;
    }
    toast({ title: `Report ${status}` });
    load();
  };

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" /> Moderation queue
      </h1>
      {items === null ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : items.length === 0 ? (
        <EmptyState icon={ShieldCheck} title="Queue is clear" description="No open reports right now." />
      ) : (
        <div className="space-y-2">
          {items.map((r) => (
            <div key={r.id} className="surface-card p-4">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{r.target_type} · {r.target_id.slice(0, 8)}…</span>
                <span>{timeAgo(r.created_at)} · {r.status}</span>
              </div>
              <p className="mt-2 text-sm whitespace-pre-wrap">{r.reason}</p>
              {r.status === "open" && (
                <div className="mt-3 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => resolve(r.id, "dismissed")}>
                    <X className="h-3.5 w-3.5 mr-1" /> Dismiss
                  </Button>
                  <Button size="sm" className="bg-gradient-brand text-primary-foreground" onClick={() => resolve(r.id, "resolved")}>
                    <Check className="h-3.5 w-3.5 mr-1" /> Resolve
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}