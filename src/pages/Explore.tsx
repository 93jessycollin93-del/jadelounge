import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Compass } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initialsOf } from "@/lib/format";
import { EmptyState } from "@/components/common/EmptyState";

interface PRow { id: string; username: string; display_name: string; avatar_url: string | null; bio: string | null }
interface CRow { id: string; slug: string; name: string; description: string | null; member_count: number }

export default function Explore() {
  const [q, setQ] = useState("");
  const [people, setPeople] = useState<PRow[]>([]);
  const [comms, setComms] = useState<CRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(async () => {
      setLoading(true);
      const term = q.trim();
      const filterPeople = term
        ? supabase
            .from("profiles")
            .select("id, username, display_name, avatar_url, bio")
            .or(`username.ilike.%${term}%,display_name.ilike.%${term}%`)
            .limit(20)
        : supabase.from("profiles").select("id, username, display_name, avatar_url, bio").order("created_at", { ascending: false }).limit(12);
      const filterComms = term
        ? supabase
            .from("communities")
            .select("id, slug, name, description, member_count")
            .or(`name.ilike.%${term}%,slug.ilike.%${term}%`)
            .limit(20)
        : supabase.from("communities").select("id, slug, name, description, member_count").order("member_count", { ascending: false }).limit(12);
      const [{ data: p }, { data: c }] = await Promise.all([filterPeople, filterComms]);
      setPeople((p ?? []) as PRow[]);
      setComms((c ?? []) as CRow[]);
      setLoading(false);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search people and communities…"
          className="pl-9 h-11 rounded-full"
        />
      </div>

      <section>
        <h2 className="font-display font-semibold mb-2">People</h2>
        {loading && people.length === 0 ? null : people.length === 0 ? (
          <EmptyState icon={Compass} title="No people found" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {people.map((p) => (
              <Link key={p.id} to={`/u/${p.username}`} className="surface-card p-3 flex items-center gap-3 hover:shadow-elevated transition">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={p.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs">{initialsOf(p.display_name)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{p.display_name}</p>
                  <p className="text-xs text-muted-foreground truncate">@{p.username}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display font-semibold mb-2">Communities</h2>
        {comms.length === 0 ? (
          <EmptyState icon={Compass} title="No communities found" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {comms.map((c) => (
              <Link key={c.id} to={`/c/${c.slug}`} className="surface-card p-3 flex items-center gap-3 hover:shadow-elevated transition">
                <div className="w-10 h-10 rounded-xl bg-gradient-brand text-primary-foreground flex items-center justify-center font-display font-semibold">
                  {c.name.slice(0, 1).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{c.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{c.member_count} members</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}