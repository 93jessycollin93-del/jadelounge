import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { NotConnected } from "@/components/common/NotConnected";

const profileSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  location: z.string().trim().max(120).optional().or(z.literal("")),
  website: z.string().trim().url("Must be a valid URL").max(255).optional().or(z.literal("")),
});

export default function Settings() {
  const { profile, refreshProfile } = useAuth();
  const [saving, setSaving] = useState(false);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!profile) return;
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) {
      toast({ title: "Invalid input", description: parsed.error.issues[0].message, variant: "destructive" });
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        bio: parsed.data.bio || null,
        location: parsed.data.location || null,
        website: parsed.data.website || null,
      })
      .eq("id", profile.id);
    setSaving(false);
    if (error) {
      toast({ title: "Could not save", description: error.message, variant: "destructive" });
      return;
    }
    await refreshProfile();
    toast({ title: "Profile updated" });
  };

  if (!profile) return null;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h1 className="font-display text-2xl font-semibold">Settings & privacy</h1>

      <form onSubmit={save} className="surface-card p-5 space-y-4">
        <h2 className="font-display font-semibold">Profile</h2>
        <div>
          <Label className="text-xs">Display name</Label>
          <Input name="display_name" defaultValue={profile.display_name} maxLength={80} />
        </div>
        <div>
          <Label className="text-xs">Bio</Label>
          <Textarea name="bio" defaultValue={profile.bio ?? ""} maxLength={500} rows={3} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Location</Label>
            <Input name="location" defaultValue={(profile as { location?: string }).location ?? ""} maxLength={120} />
          </div>
          <div>
            <Label className="text-xs">Website</Label>
            <Input name="website" defaultValue={(profile as { website?: string }).website ?? ""} placeholder="https://" />
          </div>
        </div>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving} className="bg-gradient-brand text-primary-foreground">
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>

      <div className="surface-card p-5 space-y-2">
        <h2 className="font-display font-semibold">Privacy</h2>
        <p className="text-sm text-muted-foreground">
          You control who sees each post via the visibility selector when you publish: <strong>Public</strong>,
          <strong> Followers</strong>, or <strong>Only me</strong>. Blocking and reporting tools are available on every
          post and profile.
        </p>
      </div>

      <NotConnected
        feature="Email & password change, 2FA, data export"
        note="These flows will be enabled with email-confirmation, MFA enrollment, and a data-export job in a follow-up iteration."
      />
    </div>
  );
}