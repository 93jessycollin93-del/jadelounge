import { useState } from "react";
import { z } from "zod";
import { Image as ImageIcon, Globe2, Users, Lock, Loader2 } from "lucide-react";
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

export function PostComposer({ onPosted, communityId }: { onPosted?: () => void; communityId?: string }) {
  const { profile } = useAuth();
  const [content, setContent] = useState("");
  const [visibility, setVisibility] = useState<"public" | "followers" | "private">("public");
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    const parsed = composerSchema.safeParse({ content, visibility });
    if (!parsed.success) {
      toast({ title: "Cannot post", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("posts").insert({
      content: parsed.data.content,
      visibility: parsed.data.visibility,
      author_id: profile!.id,
      community_id: communityId ?? null,
    });
    setSubmitting(false);
    if (error) {
      toast({ title: "Could not publish post", description: error.message, variant: "destructive" });
      return;
    }
    setContent("");
    setVisibility("public");
    onPosted?.();
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
          <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" size="sm" disabled className="rounded-full text-muted-foreground">
                <ImageIcon className="h-4 w-4 mr-1" /> Media
              </Button>
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
            <Button onClick={submit} disabled={submitting || !content.trim()} className="rounded-full bg-gradient-brand text-primary-foreground">
              {submitting && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Publish
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}