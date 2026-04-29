import { Logo } from "@/components/brand/Logo";

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-night gap-4">
      <div className="animate-pulse-glow rounded-2xl">
        <Logo size={48} showWordmark={false} />
      </div>
      <p className="text-sm text-muted-foreground font-display">Jade Atelier</p>
    </div>
  );
}