import { formatDbError } from "@/lib/errors";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Users2, Plus, Loader2 } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { toast } from "@/hooks/use-toast";

interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  visibility: "public" | "private";
  member_count: number;
}

const communitySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().regex(/^[a-z0-9-]{3,40}$/i, "3–40 chars: lowercase letters, numbers, dashes").transform((s) => s.toLowerCase()),
  description: z.string().trim().max(1000).optional(),
  visibility: z.enum(["public", "private"]),
});

export default function Communities() {
  const { user } = useAuth();
  const [list, setList] = useState<Community[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from("communities")
      .select("id, slug, name, description, visibility, member_count")
      .order("member_count", { ascending: false })
      .limit(50);
    if (error) {
      setError(formatDbError(error));
      return;
    }
    setList((data ?? []) as Community[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const create = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    const fd = new FormData(e.currentTarget);
    const raw = {
      name: String(fd.get("name") ?? ""),
      slug: String(fd.get("slug") ?? ""),
      description: String(fd.get("description") ?? "").trim() || undefined,
      visibility: String(fd.get("visibility") ?? "public") as "public" | "private",
    };
    const parsed = communitySchema.safeParse(raw);
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const insertPayload = {
      name: parsed.data.name,
      slug: parsed.data.slug,
      description: parsed.data.description ?? null,
      visibility: parsed.data.visibility,
      owner_id: user.id,
    };
    const { error } = await supabase.from("communities").insert(insertPayload as never);
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not create community", description: formatDbError(error), variant: "destructive" });
      return;
    }
    toast({ title: "Community created" });
    setOpen(false);
    load();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Communities</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="rounded-full bg-gradient-brand text-primary-foreground">
              <Plus className="h-4 w-4 mr-1" /> New community
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create a community</DialogTitle>
              <DialogDescription>Build a space around something you care about.</DialogDescription>
            </DialogHeader>
            <form onSubmit={create} className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input name="name" placeholder="Brutalist Architecture" required />
              </div>
              <div>
                <Label className="text-xs">URL slug</Label>
                <Input name="slug" placeholder="brutalist-architecture" required />
              </div>
              <div>
                <Label className="text-xs">Description (optional)</Label>
                <Textarea name="description" rows={3} maxLength={1000} placeholder="What is this community about?" />
              </div>
              <div>
                <Label className="text-xs">Visibility</Label>
                <select name="visibility" defaultValue="public" className="w-full mt-1 h-10 px-3 rounded-lg border border-input bg-background text-sm">
                  <option value="public">Public — anyone can find and join</option>
                  <option value="private">Private — invite only</option>
                </select>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                <Button type="submit" disabled={submitting} className="bg-gradient-brand text-primary-foreground">
                  {submitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />} Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </header>

      {error && <ErrorState message={error} onRetry={load} />}

      {list === null ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={Users2}
          title="No communities yet"
          description="Be the first to create one — it only takes a moment."
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {list.map((c) => (
            <Link
              key={c.id}
              to={`/c/${c.slug}`}
              className="surface-card p-4 hover:shadow-elevated transition flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-gradient-brand text-primary-foreground flex items-center justify-center font-display font-semibold">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">/{c.slug} · {c.visibility}</p>
                </div>
              </div>
              {c.description && <p className="text-sm text-muted-foreground line-clamp-2">{c.description}</p>}
              <p className="text-xs text-muted-foreground mt-auto">{c.member_count} members</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}