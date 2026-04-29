import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Users2, Sparkles, ShieldCheck, MessageCircle, Compass } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useAuth } from "@/contexts/AuthContext";
import { LoadingScreen } from "@/components/common/LoadingScreen";

const FEATURES = [
  { icon: Sparkles, title: "Honest, original feed", desc: "No fake engagement. No imitation brands. Just your circles." },
  { icon: Users2, title: "Communities & creator pages", desc: "Build spaces around what you actually care about." },
  { icon: MessageCircle, title: "Real conversations", desc: "Threaded comments, reactions, follows, blocks — and you're in control." },
  { icon: ShieldCheck, title: "Privacy by default", desc: "Granular post visibility, role-based moderation, audit logs." },
];

const Index = () => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/feed" replace />;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Aurora glow background */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30 blur-3xl"
        style={{ background: "var(--gradient-aurora)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-brand)" }}
      />

      <header className="relative z-10 max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Logo />
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Button asChild variant="ghost" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
          <Button asChild size="sm" className="bg-gradient-brand text-primary-foreground rounded-full">
            <Link to="/auth?mode=signup">Join</Link>
          </Button>
        </div>
      </header>

      <main className="relative z-10 max-w-6xl mx-auto px-4 pt-12 pb-24">
        <section className="text-center max-w-3xl mx-auto animate-fade-up">
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-border bg-card/60 backdrop-blur">
            <span className="w-1.5 h-1.5 rounded-full bg-success" />
            Independent · Original · Built in 2026
          </span>
          <h1 className="mt-6 text-4xl sm:text-6xl font-display font-bold tracking-tight leading-[1.05]">
            A social network <br />
            for <span className="ja-gradient-text">your circles</span>, not the algorithm.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-xl mx-auto">
            Jade Atelier is a modern community platform — posts, communities, creators, and conversations that belong to
            the people in them.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button asChild size="lg" className="bg-gradient-brand text-primary-foreground rounded-full px-7 shadow-glow">
              <Link to="/auth?mode=signup">
                Create your account <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link to="/auth">I already have an account</Link>
            </Button>
          </div>
        </section>

        <section className="mt-20 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="surface-card p-5 hover:shadow-elevated transition">
              <div className="w-10 h-10 rounded-xl bg-primary-muted dark:bg-primary/15 text-primary flex items-center justify-center mb-3">
                <f.icon className="h-5 w-5" />
              </div>
              <h3 className="font-display font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-20 surface-card p-8 text-center">
          <Compass className="h-6 w-6 mx-auto text-primary" />
          <h2 className="mt-3 font-display font-semibold text-2xl">Start exploring in under a minute</h2>
          <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
            Free to join. No credit card. No fake metrics, no fake users. Just an honest place to be online.
          </p>
          <Button asChild size="lg" className="mt-5 bg-gradient-brand text-primary-foreground rounded-full">
            <Link to="/auth?mode=signup">Get started</Link>
          </Button>
        </section>

        <footer className="mt-20 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} Jade Atelier — an independent original social platform.
        </footer>
      </main>
    </div>
  );
};

export default Index;
