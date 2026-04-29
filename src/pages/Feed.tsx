import { useCallback, useEffect, useState } from "react";
import { Newspaper } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PostComposer } from "@/components/feed/PostComposer";
import { PostCard, type FeedPost } from "@/components/feed/PostCard";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";

export default function Feed() {
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const { data, error } = await supabase
      .from("posts")
      .select(
        "id, content, visibility, like_count, comment_count, created_at, author_id, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, is_verified)"
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setError(error.message);
      setPosts([]);
      return;
    }
    setPosts(data as unknown as FeedPost[]);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      <header className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Home</h1>
      </header>

      <PostComposer onPosted={load} />

      {error && <ErrorState message={error} onRetry={load} />}

      {posts === null && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="surface-card p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-4 w-32" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {posts && posts.length === 0 && !error && (
        <EmptyState
          icon={Newspaper}
          title="Your feed is empty"
          description="Follow people, join communities, or share the first post on Jade Atelier."
        />
      )}

      {posts && posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)}
    </div>
  );
}