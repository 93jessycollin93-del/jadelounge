import { Outlet, Link, NavLink, useNavigate } from "react-router-dom";
import { Home, Compass, Users2, Bell, MessageCircle, ShieldCheck, User, LogOut, Search, Plus, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LanguageSwitcher } from "@/components/i18n/LanguageSwitcher";
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
import { useUnreadNotifications } from "@/hooks/useUnreadNotifications";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

const NAV = [
  { to: "/feed", key: "home", icon: Home },
  { to: "/explore", key: "explore", icon: Compass },
  { to: "/friends", key: "friends", icon: UserPlus },
  { to: "/communities", key: "communities", icon: Users2 },
  { to: "/messages", key: "messages", icon: MessageCircle },
  { to: "/notifications", key: "notifications", icon: Bell },
] as const;

export function AppShell() {
  const { profile, isModerator, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const unreadNotifs = useUnreadNotifications();
  const unreadMsgs = useUnreadMessages();

  const badgeFor = (to: string): number => {
    if (to === "/notifications") return unreadNotifs;
    if (to === "/messages") return unreadMsgs;
    return 0;
  };

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
            <span>{t("nav.searchPlaceholder")}</span>
          </button>

          <div className="flex items-center gap-1">
            <LanguageSwitcher />
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
                  <User className="h-4 w-4 mr-2" /> {t("nav.myProfile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/settings")}>{t("nav.settings")}</DropdownMenuItem>
                {isModerator && (
                  <DropdownMenuItem onClick={() => navigate("/moderation")}>
                    <ShieldCheck className="h-4 w-4 mr-2" /> {t("nav.moderation")}
                  </DropdownMenuItem>
                )}
                {isAdmin && (
                  <DropdownMenuItem onClick={() => navigate("/admin")}>
                    <ShieldCheck className="h-4 w-4 mr-2" /> {t("nav.admin")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}>
                  <LogOut className="h-4 w-4 mr-2" /> {t("nav.signOut")}
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
            {NAV.map(({ to, key, icon: Icon }) => {
              const badge = badgeFor(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition relative",
                      isActive
                        ? "bg-primary-muted text-primary dark:bg-primary/15"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )
                  }
                >
                  <Icon className="h-4 w-4" />
                  <span className="flex-1">{t(`nav.${key}`)}</span>
                  {badge > 0 && (
                    <span className="ml-auto h-5 min-w-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold flex items-center justify-center">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                </NavLink>
              );
            })}
            <Button
              onClick={() => navigate("/feed?compose=1")}
              className="mt-3 rounded-xl bg-gradient-brand text-primary-foreground shadow-soft hover:shadow-elevated transition"
            >
              <Plus className="h-4 w-4 mr-1" /> {t("nav.newPost")}
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
        <div className="grid grid-cols-6">
          {NAV.map(({ to, key, icon: Icon }) => {
            const badge = badgeFor(to);
            return (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  cn(
                    "flex flex-col items-center justify-center py-2.5 gap-0.5 text-[10px] font-medium relative",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )
                }
              >
                <span className="relative">
                  <Icon className="h-5 w-5" />
                  {badge > 0 && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-semibold flex items-center justify-center">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                <span>{t(`nav.${key}`)}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function RightRail() {
  const { t } = useTranslation();
  return (
    <div className="sticky top-20 space-y-4">
      <div className="surface-card p-4">
        <h4 className="font-display font-semibold text-sm mb-2">{t("rightRail.welcomeTitle")}</h4>
        <p className="text-xs text-muted-foreground leading-relaxed">{t("rightRail.welcomeBody")}</p>
      </div>
      <div className="surface-card p-4 text-xs text-muted-foreground space-y-1">
        <p>© {new Date().getFullYear()} Jade Atelier</p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <a href="#" className="hover:text-foreground">{t("rightRail.terms")}</a>
          <a href="#" className="hover:text-foreground">{t("rightRail.privacy")}</a>
          <a href="#" className="hover:text-foreground">{t("rightRail.guidelines")}</a>
          <a href="#" className="hover:text-foreground">{t("rightRail.about")}</a>
        </div>
      </div>
    </div>
  );
}