import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users2, UserCheck, X, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/common/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { initialsOf, timeAgo } from "@/lib/format";
import { toast } from "@/hooks/use-toast";

interface Row {
  id: string;
  status: string;
  sender_id: string;
  recipient_id: string;
  created_at: string;
  sender: { username: string; display_name: string; avatar_url: string | null } | null;
  recipient: { username: string; display_name: string; avatar_url: string | null } | null;
}

export default function Friends() {
  const { user } = useAuth();
  const [incoming, setIncoming] = useState<Row[] | null>(null);
  const [outgoing, setOutgoing] = useState<Row[] | null>(null);
  const [friends, setFriends] = useState<Row[] | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("friend_requests")
      .select(
        "id, status, sender_id, recipient_id, created_at, sender:profiles!friend_requests_sender_id_fkey(username, display_name, avatar_url), recipient:profiles!friend_requests_recipient_id_fkey(username, display_name, avatar_url)"
      )
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as Row[];
    setIncoming(rows.filter((r) => r.status === "pending" && r.recipient_id === user.id));
    setOutgoing(rows.filter((r) => r.status === "pending" && r.sender_id === user.id));
    setFriends(rows.filter((r) => r.status === "accepted"));
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("friend_requests_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => load()
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, load]);

  const accept = async (id: string) => {
    const { error } = await supabase
      .from("friend_requests")
      .update({ status: "accepted", responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    load();
  };

  const decline = async (id: string) => {
    await supabase
      .from("friend_requests")
      .update({ status: "declined", responded_at: new Date().toISOString() })
      .eq("id", id);
    load();
  };

  const cancel = async (id: string) => {
    await supabase.from("friend_requests").delete().eq("id", id);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-semibold">Friends</h1>
      <Tabs defaultValue="friends">
        <TabsList className="rounded-full">
          <TabsTrigger value="friends" className="rounded-full">
            Friends {friends && `(${friends.length})`}
          </TabsTrigger>
          <TabsTrigger value="incoming" className="rounded-full">
            Requests {incoming && incoming.length > 0 && `(${incoming.length})`}
          </TabsTrigger>
          <TabsTrigger value="outgoing" className="rounded-full">
            Sent
          </TabsTrigger>
        </TabsList>

        <TabsContent value="friends" className="space-y-2 mt-4">
          {friends === null ? (
            <Skeleton className="h-16 rounded-2xl" />
          ) : friends.length === 0 ? (
            <EmptyState icon={Users2} title="No friends yet" description="Find people on Explore and send a friend request." />
          ) : (
            friends.map((r) => {
              const other = r.sender_id === user?.id ? r.recipient : r.sender;
              if (!other) return null;
              return (
                <Link
                  key={r.id}
                  to={`/u/${other.username}`}
                  className="surface-card p-3 flex items-center gap-3 hover:shadow-elevated transition"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={other.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs">
                      {initialsOf(other.display_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{other.display_name}</p>
                    <p className="text-xs text-muted-foreground truncate">@{other.username}</p>
                  </div>
                </Link>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="incoming" className="space-y-2 mt-4">
          {incoming === null ? (
            <Skeleton className="h-16 rounded-2xl" />
          ) : incoming.length === 0 ? (
            <EmptyState icon={Inbox} title="No pending requests" description="When someone sends you a friend request, it'll show up here." />
          ) : (
            incoming.map((r) => (
              <div key={r.id} className="surface-card p-3 flex items-center gap-3">
                <Link to={`/u/${r.sender?.username}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={r.sender?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs">
                      {initialsOf(r.sender?.display_name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{r.sender?.display_name}</p>
                  <p className="text-xs text-muted-foreground">{timeAgo(r.created_at)}</p>
                </div>
                <Button size="sm" onClick={() => accept(r.id)} className="rounded-full bg-gradient-brand text-primary-foreground">
                  <UserCheck className="h-3.5 w-3.5 mr-1" /> Accept
                </Button>
                <Button size="sm" variant="outline" onClick={() => decline(r.id)} className="rounded-full">
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="outgoing" className="space-y-2 mt-4">
          {outgoing === null ? (
            <Skeleton className="h-16 rounded-2xl" />
          ) : outgoing.length === 0 ? (
            <EmptyState icon={Inbox} title="No outgoing requests" description="Requests you send will appear here while pending." />
          ) : (
            outgoing.map((r) => (
              <div key={r.id} className="surface-card p-3 flex items-center gap-3">
                <Link to={`/u/${r.recipient?.username}`}>
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={r.recipient?.avatar_url ?? undefined} />
                    <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs">
                      {initialsOf(r.recipient?.display_name)}
                    </AvatarFallback>
                  </Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{r.recipient?.display_name}</p>
                  <p className="text-xs text-muted-foreground">Sent {timeAgo(r.created_at)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => cancel(r.id)} className="rounded-full">
                  Cancel
                </Button>
              </div>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}