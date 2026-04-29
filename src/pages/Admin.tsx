import { useEffect, useState } from "react";
import { ShieldCheck, Users2, Newspaper, Flag } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NotConnected } from "@/components/common/NotConnected";

interface Stats {
  users: number;
  posts: number;
  communities: number;
  reportsOpen: number;
}

export default function Admin() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("*", { count: "exact", head: true }),
      supabase.from("posts").select("*", { count: "exact", head: true }),
      supabase.from("communities").select("*", { count: "exact", head: true }),
      supabase.from("reports").select("*", { count: "exact", head: true }).eq("status", "open"),
    ]).then(([u, p, c, r]) => {
      setStats({ users: u.count ?? 0, posts: p.count ?? 0, communities: c.count ?? 0, reportsOpen: r.count ?? 0 });
    });
  }, []);

  const cards = [
    { label: "Users", value: stats?.users, icon: Users2 },
    { label: "Posts", value: stats?.posts, icon: Newspaper },
    { label: "Communities", value: stats?.communities, icon: ShieldCheck },
    { label: "Open reports", value: stats?.reportsOpen, icon: Flag },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-semibold flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-primary" /> Admin dashboard
      </h1>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map((c) => (
          <div key={c.label} className="surface-card p-4">
            <c.icon className="h-4 w-4 text-muted-foreground" />
            <p className="mt-2 text-2xl font-display font-semibold tabular-nums">{c.value ?? "—"}</p>
            <p className="text-xs text-muted-foreground">{c.label}</p>
          </div>
        ))}
      </div>

      <NotConnected
        feature="Realtime analytics, payments, ad metrics"
        note="Counts above are live from your database. Analytics, billing, and live-user dashboards will appear here when their providers are connected — never as fake demo data."
      />
    </div>
  );
}