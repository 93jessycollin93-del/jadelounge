import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Users2, UserPlus, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PostComposer } from "@/components/feed/PostComposer";
import { PostCard, type FeedPost } from "@/components/feed/PostCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Newspaper } from "lucide-react";

interface Community {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  banner_url: string | null;
  icon_url: string | null;
  visibility: "public" | "private";
  owner_id: string;
  member_count: number;
}

export default function CommunityPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();
  const [community, setCommunity] = useState<Community | null | "missing">(null);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [isMember, setIsMember] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!slug) return;
    setError(null);
    const { data, error: e1 } = await supabase.from("communities").select("*").eq("slug", slug).maybeSingle();
    if (e1) {
      setError(e1.message);
      return;
    }
    if (!data) {
      setCommunity("missing");
      return;
    }
    setCommunity(data as Community);

    const [{ data: postRows }, { data: memberRow }] = await Promise.all([
      supabase
        .from("posts")
        .select(
          "id, content, visibility, like_count, comment_count, created_at, author_id, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, is_verified)"
        )
        .eq("community_id", data.id)
        .order("created_at", { ascending: false })
        .limit(30),
      user
        ? supabase.from("community_members").select("user_id").eq("community_id", data.id).eq("user_id", user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    setPosts((postRows as unknown as FeedPost[]) ?? []);
    setIsMember(!!memberRow);
  }, [slug, user]);

  useEffect(() => {
    load();
  }, [load]);

  const toggleJoin = async () => {
    if (!user || !community || community === "missing") return;
    if (isMember) {
      setIsMember(false);
      await supabase.from("community_members").delete().eq("community_id", community.id).eq("user_id", user.id);
    } else {
      setIsMember(true);
      await supabase.from("community_members").insert({ community_id: community.id, user_id: user.id });
    }
    load();
  };

  if (community === "missing") return <EmptyState icon={Users2} title="Community not found" />;
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!community) return <Skeleton className="h-40 rounded-2xl" />;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="surface-card overflow-hidden">
        <div className="h-28 bg-gradient-aurora">
          {community.banner_url && <img src={community.banner_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="p-5 -mt-8">
          <div className="flex items-end justify-between gap-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-brand text-primary-foreground flex items-center justify-center font-display font-bold text-2xl ring-4 ring-card">
              {community.name.slice(0, 1).toUpperCase()}
            </div>
            {user && community.owner_id !== user.id && (
              <Button onClick={toggleJoin} size="sm" className={`rounded-full ${isMember ? "" : "bg-gradient-brand text-primary-foreground"}`} variant={isMember ? "outline" : "default"}>
                {isMember ? <><UserMinus className="h-3.5 w-3.5 mr-1" /> Leave</> : <><UserPlus className="h-3.5 w-3.5 mr-1" /> Join</>}
              </Button>
            )}
          </div>
          <h1 className="mt-3 font-display text-2xl font-semibold">{community.name}</h1>
          <p className="text-xs text-muted-foreground">/{community.slug} · {community.visibility} · {community.member_count} members</p>
          {community.description && <p className="mt-3 text-sm whitespace-pre-wrap">{community.description}</p>}
        </div>
      </div>

      {(isMember || community.owner_id === user?.id) && <PostComposer onPosted={load} communityId={community.id} />}

      {posts === null ? (
        <Skeleton className="h-24 rounded-2xl" />
      ) : posts.length === 0 ? (
        <EmptyState icon={Newspaper} title="No posts in this community yet" description={isMember ? "Be the first to share." : "Join to start posting."} />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)
      )}
    </div>
  );
}