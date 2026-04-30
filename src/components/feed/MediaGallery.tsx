import { useEffect, useState } from "react";
import { Play } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

export interface PostMedia {
  id: string;
  url: string;
  media_type: "image" | "video";
  position: number;
  storage_path?: string | null;
}

function isLikelyHttpUrl(s: string | null | undefined): boolean {
  return !!s && /^https?:\/\//i.test(s);
}

async function resolveSignedUrls(media: PostMedia[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  await Promise.all(
    media.map(async (m) => {
      const path = m.storage_path ?? (isLikelyHttpUrl(m.url) ? null : m.url);
      if (!path) {
        result[m.id] = m.url;
        return;
      }
      const { data, error } = await supabase.storage
        .from("post-media")
        .createSignedUrl(path, 60 * 60);
      result[m.id] = error || !data ? m.url : data.signedUrl;
    })
  );
  return result;
}

export function MediaGallery({ media }: { media: PostMedia[] }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);
  const [signed, setSigned] = useState<Record<string, string>>({});
  if (!media || media.length === 0) return null;

  const sorted = [...media].sort((a, b) => a.position - b.position);
  const count = sorted.length;

  useEffect(() => {
    let cancelled = false;
    resolveSignedUrls(sorted).then((map) => {
      if (!cancelled) setSigned(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [media.map((m) => m.id).join(",")]);

  const srcOf = (m: PostMedia) => signed[m.id] ?? (isLikelyHttpUrl(m.url) ? m.url : "");

  // Dynamic grid layout based on count (Facebook-style)
  const gridClass =
    count === 1
      ? "grid-cols-1"
      : count === 2
      ? "grid-cols-2"
      : count === 3
      ? "grid-cols-2 grid-rows-2"
      : "grid-cols-2 grid-rows-2";

  const heightClass = count === 1 ? "max-h-[520px]" : "h-[360px] sm:h-[420px]";

  return (
    <>
      <div
        className={cn(
          "mt-3 grid gap-1 rounded-2xl overflow-hidden bg-muted",
          gridClass,
          heightClass
        )}
      >
        {sorted.slice(0, 4).map((m, i) => {
          const isFirstOfThree = count === 3 && i === 0;
          const overlayMore = count > 4 && i === 3 ? count - 4 : 0;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setOpenIdx(i)}
              className={cn(
                "relative group overflow-hidden bg-background/40",
                isFirstOfThree && "row-span-2"
              )}
              aria-label={`Open ${m.media_type}`}
            >
              {m.media_type === "image" ? (
                <img
                  src={srcOf(m)}
                  alt=""
                  loading="lazy"
                  className="w-full h-full object-cover transition group-hover:scale-[1.02]"
                />
              ) : (
                <>
                  <video
                    src={srcOf(m)}
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="h-12 w-12 rounded-full bg-background/70 backdrop-blur flex items-center justify-center">
                      <Play className="h-5 w-5 fill-foreground" />
                    </span>
                  </span>
                </>
              )}
              {overlayMore > 0 && (
                <span className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center text-2xl font-display font-semibold">
                  +{overlayMore}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <Dialog open={openIdx !== null} onOpenChange={(o) => !o && setOpenIdx(null)}>
        <DialogContent className="max-w-4xl p-0 bg-background border-border overflow-hidden">
          {openIdx !== null && sorted[openIdx] && (
            <div className="relative w-full max-h-[80vh] flex items-center justify-center bg-black">
              {sorted[openIdx].media_type === "image" ? (
                <img
                  src={srcOf(sorted[openIdx])}
                  alt=""
                  className="max-h-[80vh] w-auto object-contain"
                />
              ) : (
                <video
                  src={srcOf(sorted[openIdx])}
                  className="max-h-[80vh] w-full"
                  controls
                  autoPlay
                  playsInline
                />
              )}
            </div>
          )}
          {count > 1 && openIdx !== null && (
            <div className="px-4 py-2 text-center text-xs text-muted-foreground bg-card">
              {openIdx + 1} / {count}
              <div className="mt-1 flex justify-center gap-1">
                {sorted.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setOpenIdx(i)}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === openIdx ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                    )}
                    aria-label={`Go to media ${i + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}