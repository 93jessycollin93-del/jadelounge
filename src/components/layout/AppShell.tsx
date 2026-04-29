import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { Home, Compass, Users2, Bell, MessageCircle, ShieldCheck, User, LogOut, Search, Plus } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/feed", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/communities", label: "Communities", icon: Users2 },
  { to: "/messages", label: "Messages", icon: MessageCircle },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

export function AppShell() {
  const { profile, isModerator, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  const initials = (profile?.display_name ?? "?")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link to="/feed" className="flex items-center gap-2 shrink-0">
            <Logo showWordmark={false} size={28} />
            <span className="hidden sm:inline font-display font-semibold tracking-tight">Jade Atelier</span>
          </Link>

          <button
            onClick={() => navigate("/explore")}
            className="flex-1 flex items-center gap-2 h-9 px-3 rounded-full bg-muted/60 hover:bg-muted transition text-sm text-muted-foreground max-w-md"
          >
            <Search className="h-4 w-4" />
            <span>Search people, communities, posts…</span>
          </button>

          <div className="flex items-center gap-1">
            <ThemeToggle />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full" aria-label="Account menu">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={profile?.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs bg-gradient-brand text-primary-foreground">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col">
                    <span className="font-medium">{profile?.display_name}</span>
                    <span className="text-xs text-muted-foreground font-normal">@{profile?.username}</span>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate(`/u/${profile?.username}`)}>
                  <User className="h-4 w-4 mr-2" /> My profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>Settings & privacy</DropdownMenuItem>
                {isModerator && (
                  <DropdownMenuItem onClick={() => navigate("/moderation")}>
                    <ShieldCheck className="h-4 w-4 mr-2" /> Moderation queue
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <ShieldCheck className="h-4 w-4 mr-2" /> Admin dashboard
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-2" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-6 grid grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[220px_1fr_280px] gap-6">
        {/* Sidebar (desktop) */}
        <aside className="hidden md:block">
          <nav className="sticky top-20 flex flex-col gap-1">
            {NAV.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition",
                    isActive
                      ? "bg-primary-muted text-primary dark:bg-primary/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )
                }
              >
                <Icon className="h-4 w-4" />
                {label}
              </NavLink>
            ))}
            <Button
              onClick={() => navigate("/feed?compose=1")}
              className="mt-3 rounded-xl bg-gradient-brand text-primary-foreground shadow-soft hover:shadow-elevated transition"
            >
              <Plus className="h-4 w-4 mr-1" /> New post
            </Button>
          </nav>
        </aside>

        <main className="min-w-0 pb-24 md:pb-6 animate-fade-in">
          <Outlet />
        </main>

        {/* Right rail */}
        <aside className="hidden lg:block">
          <RightRail />
        </aside>
      </div>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl">
        <div className="grid grid-cols-5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-medium",
                  isActive ? "text-primary" : "text-muted-foreground"
                )
              }
            >
              <Icon className="h-5 w-5" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function RightRail() {
  return (
    <div className="sticky top-20 space-y-4">
      <div className="surface-card p-4">
        <h4 className="font-display font-semibold text-sm mb-2">Welcome to Jade Atelier</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">
          An independent social network for makers, friends, and communities. Original platform — no third-party data,
          no hidden tracking.
        </p>
      </div>
      <div className="surface-card p-4 text-xs text-muted-foreground space-y-1">
        <p>© {new Date().getFullYear()} Jade Atelier</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <a href="#" className="hover:text-foreground">Terms</a>
          <a href="#" className="hover:text-foreground">Privacy</a>
          <a href="#" className="hover:text-foreground">Guidelines</a>
          <a href="#" className="hover:text-foreground">About</a>
        </div>
      </div>
    </div>
  );
}