import { useEffect, useState } from "react";
import { Ban, ShieldOff, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";

interface Props {
  targetUserId: string;
  targetName?: string;
  onChanged?: () => void;
}

export function BlockButton({ targetUserId, targetName, onChanged }: Props) {
  const { user } = useAuth();
  const [blocked, setBlocked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!user || user.id === targetUserId) return;
      const { data } = await supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id)
        .eq("blocked_id", targetUserId)
        .maybeSingle();
      if (!cancelled) setBlocked(!!data);
    })();
    return () => {
      cancelled = true;
    };
  }, [user, targetUserId]);

  if (!user || user.id === targetUserId) return null;

  const block = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("blocks")
      .insert({ blocker_id: user.id, blocked_id: targetUserId });
    setBusy(false);
    if (error) {
      toast({ title: "Could not block", description: error.message, variant: "destructive" });
      return;
    }
    setBlocked(true);
    toast({ title: "Account blocked", description: "They can no longer message you." });
    onChanged?.();
  };

  const unblock = async () => {
    setBusy(true);
    const { error } = await supabase
      .from("blocks")
      .delete()
      .eq("blocker_id", user.id)
      .eq("blocked_id", targetUserId);
    setBusy(false);
    if (error) {
      toast({ title: "Could not unblock", description: error.message, variant: "destructive" });
      return;
    }
    setBlocked(false);
    toast({ title: "Account unblocked" });
    onChanged?.();
  };

  if (blocked === null) {
    return (
      <Button size="sm" variant="outline" className="rounded-full" disabled>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </Button>
    );
  }

  if (blocked) {
    return (
      <Button size="sm" variant="outline" className="rounded-full" onClick={unblock} disabled={busy}>
        <ShieldOff className="h-3.5 w-3.5 mr-1" /> Unblock
      </Button>
    );
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="outline" className="rounded-full text-destructive hover:text-destructive">
          <Ban className="h-3.5 w-3.5 mr-1" /> Block
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Block {targetName ? `@${targetName}` : "this account"}?</AlertDialogTitle>
          <AlertDialogDescription>
            They won't be able to message you, send attachments, or start new conversations.
            Existing chats stay visible but become read-only between you two.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={block} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Block"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}