import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarDays, MapPin, Globe, BadgeCheck, UserPlus, UserCheck, Edit3, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PostCard, type FeedPost } from "@/components/feed/PostCard";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorState } from "@/components/common/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { initialsOf } from "@/lib/format";
import { Newspaper } from "lucide-react";
import { FriendButton } from "@/components/friends/FriendButton";
import { BlockButton } from "@/components/privacy/BlockButton";
import { openOrCreateConversation } from "@/lib/messaging";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";

interface PublicProfile {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  cover_url: string | null;
  location: string | null;
  website: string | null;
  is_verified: boolean;
  created_at: string;
}

export default function Profile() {
  const { username } = useParams<{ username: string }>();
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfile | null | "missing">(null);
  const [posts, setPosts] = useState<FeedPost[] | null>(null);
  const [followCounts, setFollowCounts] = useState<{ followers: number; following: number }>({ followers: 0, following: 0 });
  const [iFollow, setIFollow] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!username) return;
    setError(null);
    const { data: prof, error: pErr } = await supabase
      .from("profiles")
      .select("*")
      .eq("username", username)
      .maybeSingle();
    if (pErr) {
      setError(pErr.message);
      return;
    }
    if (!prof) {
      setProfile("missing");
      return;
    }
    setProfile(prof as PublicProfile);

    const [{ data: postRows }, { count: followers }, { count: following }] = await Promise.all([
      supabase
        .from("posts")
        .select(
          "id, content, visibility, like_count, comment_count, created_at, author_id, author:profiles!posts_author_id_fkey(username, display_name, avatar_url, is_verified), media:post_media(id, url, media_type, position)"
        )
        .eq("author_id", prof.id)
        .order("created_at", { ascending: false })
        .limit(30),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("following_id", prof.id),
      supabase.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", prof.id),
    ]);
    setPosts((postRows as unknown as FeedPost[]) ?? []);
    setFollowCounts({ followers: followers ?? 0, following: following ?? 0 });

    if (currentUser && currentUser.id !== prof.id) {
      const { data: f } = await supabase
        .from("follows")
        .select("follower_id")
        .eq("follower_id", currentUser.id)
        .eq("following_id", prof.id)
        .maybeSingle();
      setIFollow(!!f);
    }
  }, [username, currentUser]);

  useEffect(() => {
    load();
  }, [load]);

  if (profile === "missing") {
    return <EmptyState icon={Newspaper} title="Profile not found" description={`@${username} doesn't exist or was removed.`} />;
  }
  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!profile) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-24 rounded-2xl" />
      </div>
    );
  }

  const isMe = currentUser?.id === profile.id;

  const toggleFollow = async () => {
    if (!currentUser || isMe) return;
    if (iFollow) {
      setIFollow(false);
      setFollowCounts((c) => ({ ...c, followers: Math.max(0, c.followers - 1) }));
      await supabase.from("follows").delete().eq("follower_id", currentUser.id).eq("following_id", profile.id);
    } else {
      setIFollow(true);
      setFollowCounts((c) => ({ ...c, followers: c.followers + 1 }));
      await supabase.from("follows").insert({ follower_id: currentUser.id, following_id: profile.id });
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="surface-card overflow-hidden">
        <div className="h-32 sm:h-44 bg-gradient-aurora relative">
          {profile.cover_url && <img src={profile.cover_url} alt="" className="w-full h-full object-cover" />}
        </div>
        <div className="px-4 sm:px-6 pb-5 -mt-10">
          <div className="flex items-end justify-between gap-3">
            <Avatar className="h-20 w-20 ring-4 ring-card">
              <AvatarImage src={profile.avatar_url ?? undefined} />
              <AvatarFallback className="bg-gradient-brand text-primary-foreground text-lg">
                {initialsOf(profile.display_name)}
              </AvatarFallback>
            </Avatar>
            <div className="mb-2 flex flex-wrap items-center gap-1.5 justify-end">
              {isMe ? (
                <Button variant="outline" size="sm" className="rounded-full" disabled>
                  <Edit3 className="h-3.5 w-3.5 mr-1" /> Edit profile (coming)
                </Button>
              ) : currentUser ? (
                <>
                  <Button
                    onClick={toggleFollow}
                    size="sm"
                    className={`rounded-full ${iFollow ? "" : "bg-gradient-brand text-primary-foreground"}`}
                    variant={iFollow ? "outline" : "default"}
                  >
                    {iFollow ? <><UserCheck className="h-3.5 w-3.5 mr-1" /> Following</> : <><UserPlus className="h-3.5 w-3.5 mr-1" /> Follow</>}
                  </Button>
                  <FriendButton targetUserId={profile.id} />
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={async () => {
                      try {
                        const conv = await openOrCreateConversation(currentUser.id, profile.id);
                        navigate(`/messages/${conv}`);
                      } catch (e) {
                        toast({ title: "Could not open chat", description: e instanceof Error ? e.message : "Unknown", variant: "destructive" });
                      }
                    }}
                  >
                    <MessageCircle className="h-3.5 w-3.5 mr-1" /> Message
                  </Button>
                  <BlockButton targetUserId={profile.id} targetName={profile.username} />
                </>
              ) : null}
            </div>
          </div>
          <div className="mt-3">
            <div className="flex items-center gap-1.5">
              <h1 className="font-display text-xl font-semibold">{profile.display_name}</h1>
              {profile.is_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
            </div>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
            {profile.bio && <p className="mt-3 text-sm whitespace-pre-wrap">{profile.bio}</p>}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {profile.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{profile.location}</span>}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-foreground">
                  <Globe className="h-3 w-3" />{profile.website.replace(/^https?:\/\//, "")}
                </a>
              )}
              <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" />Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
            </div>
            <div className="mt-3 flex gap-4 text-sm">
              <span><strong>{followCounts.following}</strong> <span className="text-muted-foreground">Following</span></span>
              <span><strong>{followCounts.followers}</strong> <span className="text-muted-foreground">Followers</span></span>
            </div>
          </div>
        </div>
      </div>

      {posts === null ? (
        <Skeleton className="h-32 rounded-2xl" />
      ) : posts.length === 0 ? (
        <EmptyState icon={Newspaper} title="No posts yet" description={isMe ? "Share something — your audience awaits." : "This user hasn't posted yet."} />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} onChanged={load} />)
      )}
    </div>
  );
}