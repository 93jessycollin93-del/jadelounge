import { useEffect, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { toast } from "@/hooks/use-toast";
import { LoadingScreen } from "@/components/common/LoadingScreen";

const signInSchema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(8, "Password must be at least 8 characters").max(72),
});

const signUpSchema = signInSchema.extend({
  display_name: z.string().trim().min(1, "Required").max(80),
  username: z
    .string()
    .trim()
    .regex(/^[a-z0-9_]{3,30}$/i, "3–30 chars, letters/numbers/_ only")
    .transform((s) => s.toLowerCase()),
});

export default function Auth() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [mode, setMode] = useState<"signin" | "signup">(params.get("mode") === "signup" ? "signup" : "signin");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    setMode(params.get("mode") === "signup" ? "signup" : "signin");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search]);

  if (loading) return <LoadingScreen />;
  if (user) return <Navigate to="/feed" replace />;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd.entries());

    if (mode === "signin") {
      const parsed = signInSchema.safeParse(raw);
      if (!parsed.success) {
        setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""])));
        return;
      }
      setSubmitting(true);
      const { error } = await supabase.auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
      setSubmitting(false);
      if (error) {
        toast({ title: "Sign-in failed", description: error.message, variant: "destructive" });
        return;
      }
      navigate("/feed");
    } else {
      const parsed = signUpSchema.safeParse(raw);
      if (!parsed.success) {
        setErrors(Object.fromEntries(Object.entries(parsed.error.flatten().fieldErrors).map(([k, v]) => [k, v?.[0] ?? ""])));
        return;
      }
      setSubmitting(true);
      const { error } = await supabase.auth.signUp({
        email: parsed.data.email,
        password: parsed.data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/feed`,
          data: {
            username: parsed.data.username,
            display_name: parsed.data.display_name,
          },
        },
      });
      setSubmitting(false);
      if (error) {
        toast({ title: "Sign-up failed", description: error.message, variant: "destructive" });
        return;
      }
      toast({ title: "Welcome to Jade Atelier", description: "Your account is ready." });
      navigate("/feed");
    }
  };

  return (
    <div className="min-h-screen relative bg-background overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-40 -right-40 w-[500px] h-[500px] rounded-full opacity-20 blur-3xl"
        style={{ background: "var(--gradient-aurora)" }}
      />
      <header className="relative z-10 px-4 h-16 flex items-center justify-between max-w-6xl mx-auto">
        <Link to="/"><Logo /></Link>
        <ThemeToggle />
      </header>

      <main className="relative z-10 max-w-md mx-auto px-4 pt-8 pb-16 animate-fade-up">
        <div className="surface-card p-6 sm:p-8">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            {mode === "signin" ? "Welcome back" : "Create your account"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {mode === "signin" ? "Sign in to continue to Jade Atelier." : "Pick a username — you can change your display name anytime."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            {mode === "signup" && (
              <>
                <Field label="Display name" name="display_name" placeholder="Your name" error={errors.display_name} autoComplete="name" />
                <Field label="Username" name="username" placeholder="yourname" error={errors.username} autoComplete="username" prefix="@" />
              </>
            )}
            <Field label="Email" name="email" type="email" placeholder="you@example.com" error={errors.email} autoComplete="email" />
            <Field
              label="Password"
              name="password"
              type="password"
              placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
              error={errors.password}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
            />

            <Button type="submit" disabled={submitting} className="w-full bg-gradient-brand text-primary-foreground rounded-xl">
              {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
            </Button>
          </form>

          <div className="mt-6 text-sm text-center text-muted-foreground">
            {mode === "signin" ? (
              <>
                New here?{" "}
                <Link to="/auth?mode=signup" className="text-primary font-medium hover:underline">
                  Create an account
                </Link>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <Link to="/auth" className="text-primary font-medium hover:underline">
                  Sign in
                </Link>
              </>
            )}
          </div>

          <p className="mt-6 text-[11px] text-muted-foreground text-center leading-relaxed">
            By continuing you agree to our community guidelines. Jade Atelier is an independent platform — your data
            stays on your account.
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  error,
  autoComplete,
  prefix,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  prefix?: string;
}) {
  return (
    <div>
      <Label htmlFor={name} className="text-xs font-medium">{label}</Label>
      <div className="relative mt-1">
        {prefix && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground pointer-events-none">
            {prefix}
          </span>
        )}
        <Input
          id={name}
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className={prefix ? "pl-7" : ""}
          aria-invalid={!!error}
        />
      </div>
      {error && <p className="mt-1 text-xs text-destructive">{error}</p>}
    </div>
  );
}