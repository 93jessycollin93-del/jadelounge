import { useState } from "react";
import { z } from "zod";
import { Image as ImageIcon, Video, Globe2, Users, Lock, Loader2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { initialsOf } from "@/lib/format";

const composerSchema = z.object({
  content: z.string().trim().min(1, "Write something").max(5000, "Max 5000 characters"),
  visibility: z.enum(["public", "followers", "private"]),
});

const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB
const MAX_FILES = 6;
const ACCEPTED = "image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm,video/quicktime";

interface PendingFile {
  file: File;
  previewUrl: string;
  kind: "image" | "video";
}

export function PostComposer({ onPosted, communityId }: { onPosted?: () => void; communityId?: string }) {
  const { profile } = useAuth();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [submitting, setSubmitting] = useState(false);
  const [files, setFiles] = useState<PendingFile[]>([]);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    e.target.value = "";
    const next: PendingFile[] = [];
    for (const f of picked) {
      if (files.length + next.length >= MAX_FILES) {
        toast({ title: `Max ${MAX_FILES} files per post`, variant: "destructive" });
        break;
      }
      const isVideo = f.type.startsWith("video/");
      const isImage = f.type.startsWith("image/");
      if (!isVideo && !isImage) {
        toast({ title: "Unsupported file", description: f.name, variant: "destructive" });
        continue;
      }
      const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (f.size > limit) {
        toast({
          title: "File too large",
          description: `${f.name} exceeds ${isVideo ? "100MB" : "10MB"}`,
          variant: "destructive",
        });
        continue;
      }
      next.push({ file: f, previewUrl: URL.createObjectURL(f), kind: isVideo ? "video" : "image" });
    }
    setFiles((prev) => [...prev, ...next]);
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => {
      const copy = [...prev];
      const [removed] = copy.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return copy;
    });
  };

  const submit = async () => {
    const hasMedia = files.length > 0;
    const parsed = composerSchema.safeParse({
      content: hasMedia && !content.trim() ? "(media)" : content,
      visibility,
    });
    if (!parsed.success) {
      toast({ title: "Cannot post", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const { data: post, error: postErr } = await supabase
        .from("posts")
        .insert({
          content: hasMedia && !content.trim() ? "" : parsed.data.content,
          visibility: parsed.data.visibility,
          author_id: profile!.id,
          community_id: communityId ?? null,
        })
        .select("id")
        .single();
      if (postErr || !post) throw new Error(postErr?.message ?? "Failed to publish");

      if (hasMedia) {
        const mediaRows: {
          post_id: string;
          url: string;
          storage_path: string;
          media_type: "image" | "video";
          position: number;
        }[] = [];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          const ext = f.file.name.split(".").pop()?.toLowerCase() ?? (f.kind === "video" ? "mp4" : "jpg");
          const path = `${profile!.id}/${post.id}/${i}-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("post-media")
            .upload(path, f.file, { contentType: f.file.type, upsert: false });
          if (upErr) throw new Error(upErr.message);
          mediaRows.push({
            post_id: post.id,
            // Bucket is private; we resolve signed URLs at render time using storage_path.
            url: path,
            storage_path: path,
            media_type: f.kind,
            position: i,
          });
        }
        const { error: mediaErr } = await supabase.from("post_media").insert(mediaRows);
        if (mediaErr) throw new Error(mediaErr.message);
      }

      files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
      setFiles([]);
      setContent("");
      setVisibility("public");
      onPosted?.();
    } catch (err) {
      toast({
        title: "Could not publish post",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="surface-card p-4">
      <div className="flex gap-3">
        <Avatar className="h-10 w-10 shrink-0">
          <AvatarImage src={profile?.avatar_url ?? undefined} />
          <AvatarFallback className="bg-gradient-brand text-primary-foreground text-sm">
            {initialsOf(profile?.display_name)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`What's on your mind, ${profile?.display_name?.split(" ")[0] ?? "friend"}?`}
            rows={3}
            maxLength={5000}
            className="resize-none border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-0 text-base"
          />
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2 mt-2">
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
                  {f.kind === "image" ? (
                    <img src={f.previewUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <video src={f.previewUrl} className="w-full h-full object-cover" muted playsInline />
                  )}
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label="Remove media"
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {f.kind === "video" && (
                    <span className="absolute bottom-1 left-1 text-[10px] bg-background/80 backdrop-blur px-1.5 py-0.5 rounded flex items-center gap-1">
                      <Video className="h-3 w-3" /> Video
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <label className="inline-flex items-center gap-1 h-8 px-3 rounded-full text-xs font-medium cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted transition">
                <ImageIcon className="h-4 w-4" /> Media
                <input
                  type="file"
                  accept={ACCEPTED}
                  multiple
                  onChange={onPick}
                  className="sr-only"
                  disabled={submitting || files.length >= MAX_FILES}
                />
              </label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as typeof visibility)}>
                <SelectTrigger className="h-8 w-auto rounded-full text-xs gap-1 px-3">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public"><span className="flex items-center gap-2"><Globe2 className="h-3.5 w-3.5" /> Public</span></SelectItem>
                  <SelectItem value="followers"><span className="flex items-center gap-2"><Users className="h-3.5 w-3.5" /> Followers</span></SelectItem>
                  <SelectItem value="private"><span className="flex items-center gap-2"><Lock className="h-3.5 w-3.5" /> Only me</span></SelectItem>
                </SelectContent>
              </Select>
              <span className="text-[10px] text-muted-foreground">{content.length}/5000</span>
            </div>
            <Button
              onClick={submit}
              disabled={submitting || (!content.trim() && files.length === 0)}
              className="rounded-full bg-gradient-brand text-primary-foreground"
            >
              {submitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              {submitting ? "Publishing…" : "Publish"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}