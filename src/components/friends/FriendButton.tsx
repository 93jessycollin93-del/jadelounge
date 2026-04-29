import { useEffect, useState } from "react";
import { UserPlus, UserCheck, Clock, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";

type Status = "none" | "pending_out" | "pending_in" | "friends" | "loading";

interface Props {
  targetUserId: string;
  className?: string;
}

export function FriendButton({ targetUserId, className }: Props) {
  const { user } = useAuth();
  const [status, setStatus] = useState<Status>("loading");
  const [requestId, setRequestId] = useState<string | null>(null);

  const refresh = async () => {
    if (!user || user.id === targetUserId) return;
    const { data } = await supabase
      .from("friend_requests")
      .select("id, sender_id, recipient_id, status")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${targetUserId}),and(sender_id.eq.${targetUserId},recipient_id.eq.${user.id})`
      )
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (!row) {
      setStatus("none");
      setRequestId(null);
      return;
    }
    setRequestId(row.id);
    if (row.status === "accepted") setStatus("friends");
    else if (row.status === "pending" && row.sender_id === user.id) setStatus("pending_out");
    else if (row.status === "pending") setStatus("pending_in");
    else setStatus("none");
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, targetUserId]);

  if (!user || user.id === targetUserId) return null;

  const send = async () => {
    setStatus("loading");
    const { error } = await supabase
      .from("friend_requests")
      .insert({ sender_id: user.id, recipient_id: targetUserId, status: "pending" });
    if (error) {
      toast({ title: "Could not send request", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Friend request sent" });
    }
    refresh();
  };

  const cancel = async () => {
    if (!requestId) return;
    setStatus("loading");
    await supabase.from("friend_requests").delete().eq("id", requestId);
    refresh();
  };

  const accept = async () => {
    if (!requestId) return;
    setStatus("loading");
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", requestId);
    if (error) toast({ title: "Could not accept", description: error.message, variant: "destructive" });
    refresh();
  };

  const decline = async () => {
    if (!requestId) return;
    setStatus("loading");
    await supabase
      .from("friend_requests")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", requestId);
    refresh();
  };

  if (status === "loading") {
    return (
      <Button size="sm" variant="outline" className={`rounded-full ${className ?? ""}`} disabled>
        …
      </Button>
    );
  }
  if (status === "friends") {
    return (
      <Button size="sm" variant="outline" className={`rounded-full ${className ?? ""}`} disabled>
        <UserCheck className="h-3.5 w-3.5 mr-1" /> Friends
      </Button>
    );
  }
  if (status === "pending_out") {
    return (
      <Button size="sm" variant="outline" onClick={cancel} className={`rounded-full ${className ?? ""}`}>
        <Clock className="h-3.5 w-3.5 mr-1" /> Requested
      </Button>
    );
  }
  if (status === "pending_in") {
    return (
      <div className={`flex gap-1 ${className ?? ""}`}>
        <Button size="sm" onClick={accept} className="rounded-full bg-gradient-brand text-primary-foreground">
          <UserCheck className="h-3.5 w-3.5 mr-1" /> Accept
        </Button>
        <Button size="sm" variant="outline" onClick={decline} className="rounded-full">
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    );
  }
  return (
    <Button size="sm" onClick={send} className={`rounded-full bg-gradient-brand text-primary-foreground ${className ?? ""}`}>
      <UserPlus className="h-3.5 w-3.5 mr-1" /> Add friend
    </Button>
  );
}