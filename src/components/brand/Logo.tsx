import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  size?: number;
}

export function Logo({ className, showWordmark = true, size = 32 }: LogoProps) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="ja-mark-grad" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="hsl(243 80% 65%)" />
            <stop offset="60%" stopColor="hsl(258 75% 60%)" />
            <stop offset="100%" stopColor="hsl(330 70% 60%)" />
          </linearGradient>
        </defs>
        <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#ja-mark-grad)" />
        <path
          d="M14 12 L26 12 L26 24 C26 28.4 22.4 32 18 32 C15.2 32 13 30.6 12 28.5"
          stroke="white"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <circle cx="29" cy="11" r="2.6" fill="white" />
      </svg>
      {showWordmark && (
        <span className="font-display font-semibold text-lg tracking-tight">
          Jade<span className="text-muted-foreground font-normal"> Atelier</span>
        </span>
      )}
    </div>
  );
}