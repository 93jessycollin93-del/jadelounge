import { PlugZap } from "lucide-react";

/** Honest "not connected / no data" placeholder for un-integrated surfaces. */
export function NotConnected({ feature, note }: { feature: string; note?: string }) {
  return (
    <div className="surface-card p-6 flex items-start gap-3">
      <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <PlugZap className="h-5 w-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium text-sm">{feature} — not connected yet</p>
        <p className="text-xs text-muted-foreground mt-1">
          {note ?? "This surface is real but no provider/data source is connected. No fake data is shown."}
        </p>
      </div>
    </div>
  );
}