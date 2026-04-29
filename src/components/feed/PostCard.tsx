import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Share2, MoreHorizontal, Flag, Trash2, Globe2, Users, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { initialsOf, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";
import { z } from "zod";

export interface FeedPost {
  id: string;
  content: string;
  visibility: "public" | "followers" | "private";
  like_count: number;
  comment_count: number;
  created_at: string;
  author_id: string;
  author?: {
    username: string;
    display_name: string;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
}

interface CommentRow {
  id: string;
  content: string;
  created_at: string;
  author_id: string;
  author?: { username: string; display_name: string; avatar_url: string | null } | null;
}

const reportSchema = z.object({ reason: z.string().trim().min(3, "Please describe the issue").max(1000) });
const commentSchema = z.object({ content: z.string().trim().min(1).max(2000) });

export function PostCard({ post, onChanged }: { post: FeedPost; onChanged?: () => void }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [commentCount, setCommentCount] = useState(post.comment_count);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");

  useEffect(() => {
    if (!user) return;
    supabase
      .from("reactions")
      .select("post_id")
      .eq("post_id", post.id)
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data));
  }, [post.id, user]);

  const toggleLike = async () => {
    if (!user) return;
    if (liked) {
      setLiked(false);
      setLikeCount((c) => Math.max(0, c - 1));
      const { error } = await supabase.from("reactions").delete().eq("post_id", post.id).eq("user_id", user.id);
      if (error) {
        setLiked(true);
        setLikeCount((c) => c + 1);
      }
    } else {
      setLiked(true);
      setLikeCount((c) => c + 1);
      const { error } = await supabase.from("reactions").insert({ post_id: post.id, user_id: user.id, type: "like" });
      if (error) {
        setLiked(false);
        setLikeCount((c) => Math.max(0, c - 1));
      }
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const { data, error } = await supabase
      .from("comments")
      .select("id, content, created_at, author_id, author:profiles!comments_author_id_fkey(username, display_name, avatar_url)")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true })
      .limit(50);
    setLoadingComments(false);
    if (!error && data) setComments(data as unknown as CommentRow[]);
  };

  const openComments = () => {
    const willOpen = !showComments;
    setShowComments(willOpen);
    if (willOpen && comments.length === 0) loadComments();
  };

  const submitComment = async () => {
    const parsed = commentSchema.safeParse({ content: newComment });
    if (!parsed.success) return;
    if (!user) return;
    const { error } = await supabase.from("comments").insert({
      post_id: post.id,
      author_id: user.id,
      content: parsed.data.content,
    });
    if (error) {
      toast({ title: "Could not comment", description: error.message, variant: "destructive" });
      return;
    }
    setNewComment("");
    setCommentCount((c) => c + 1);
    loadComments();
  };

  const deletePost = async () => {
    if (!user || user.id !== post.author_id) return;
    const { error } = await supabase.from("posts").delete().eq("id", post.id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Post deleted" });
    onChanged?.();
  };

  const submitReport = async () => {
    if (!user) return;
    const parsed = reportSchema.safeParse({ reason: reportReason });
    if (!parsed.success) {
      toast({ title: "Invalid report", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: "post",
      target_id: post.id,
      reason: parsed.data.reason,
    });
    if (error) {
      toast({ title: "Could not submit report", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Report submitted", description: "Our moderators will review it." });
    setReportOpen(false);
    setReportReason("");
  };

  const VisIcon = post.visibility === "public" ? Globe2 : post.visibility === "followers" ? Users : Lock;

  return (
    <article className="surface-card p-4 hover:shadow-elevated transition">
      <header className="flex items-start gap-3">
        <Link to={post.author ? `/u/${post.author.username}` : "#"}>
          <Avatar className="h-10 w-10">
            <AvatarImage src={post.author?.avatar_url ?? undefined} />
            <AvatarFallback className="bg-gradient-brand text-primary-foreground text-xs">
              {initialsOf(post.author?.display_name)}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <Link
              to={post.author ? `/u/${post.author.username}` : "#"}
              className="font-semibold text-sm hover:underline truncate"
            >
              {post.author?.display_name ?? "Unknown"}
            </Link>
            <span className="text-xs text-muted-foreground truncate">@{post.author?.username ?? "unknown"}</span>
            <span className="text-xs text-muted-foreground">·</span>
            <span className="text-xs text-muted-foreground">{timeAgo(post.created_at)}</span>
            <VisIcon className="h-3 w-3 text-muted-foreground" aria-label={post.visibility} />
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="Post actions">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {user?.id === post.author_id ? (
              <DropdownMenuItem onClick={deletePost} className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" /> Delete post
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem onClick={() => setReportOpen(true)}>
                <Flag className="h-4 w-4 mr-2" /> Report post
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words">{post.content}</p>

      <div className="mt-3 flex items-center gap-1 -ml-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleLike}
          className={cn("rounded-full gap-1.5", liked && "text-primary")}
        >
          <Heart className={cn("h-4 w-4", liked && "fill-current")} />
          <span className="text-xs tabular-nums">{likeCount}</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={openComments} className="rounded-full gap-1.5">
          <MessageCircle className="h-4 w-4" />
          <span className="text-xs tabular-nums">{commentCount}</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/p/${post.id}`);
            toast({ title: "Link copied to clipboard" });
          }}
          className="rounded-full gap-1.5"
        >
          <Share2 className="h-4 w-4" />
        </Button>
      </div>

      {showComments && (
        <div className="mt-3 pt-3 border-t border-border space-y-3 animate-fade-in">
          {loadingComments ? (
            <p className="text-xs text-muted-foreground">Loading comments…</p>
          ) : comments.length === 0 ? (
            <p className="text-xs text-muted-foreground">Be the first to reply.</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-2">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={c.author?.avatar_url ?? undefined} />
                  <AvatarFallback className="text-[10px] bg-gradient-brand text-primary-foreground">
                    {initialsOf(c.author?.display_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 bg-muted/60 rounded-2xl px-3 py-2">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="font-semibold">{c.author?.display_name ?? "Unknown"}</span>
                    <span className="text-muted-foreground">{timeAgo(c.created_at)}</span>
                  </div>
                  <p className="text-sm mt-0.5 whitespace-pre-wrap break-words">{c.content}</p>
                </div>
              </div>
            ))
          )}

          <div className="flex gap-2">
            <Textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              maxLength={2000}
              rows={1}
              placeholder="Write a comment…"
              className="resize-none rounded-2xl bg-muted/60 border-0 text-sm focus-visible:ring-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitComment();
              }}
            />
            <Button onClick={submitComment} disabled={!newComment.trim()} size="sm" className="self-end rounded-full bg-gradient-brand text-primary-foreground">
              Reply
            </Button>
          </div>
        </div>
      )}

      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report this post</DialogTitle>
            <DialogDescription>
              Tell us what's wrong. Reports are reviewed by our moderation team.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reportReason}
            onChange={(e) => setReportReason(e.target.value)}
            placeholder="Describe the issue (3–1000 characters)"
            rows={4}
            maxLength={1000}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button onClick={submitReport} className="bg-gradient-brand text-primary-foreground">Submit report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </article>
  );
}