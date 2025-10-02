// app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false); // visual only
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Jika sudah login → redirect
  useEffect(() => {
    let mounted = true;
    
    (async () => {
      try {
        const { data } = await supabase.auth.getUser();
        if (mounted && data.user) {
          console.log('User already logged in, redirecting to:', next);
          router.replace(next);
          router.refresh();
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }
    })();
    
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Kosongkan field saat mount untuk mengurangi autofill
  useEffect(() => {
    setEmail("");
    setPassword("");
    
    // Cek apakah ada parameter verified dari email verification
    const verified = params.get("verified");
    if (verified === "true") {
      setSuccess("Email berhasil diverifikasi! Silakan login dengan email dan password Anda.");
      // Hilangkan notifikasi setelah 3 detik
      setTimeout(() => setSuccess(null), 3000);
    }
    
  }, [params]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.replace(next);
      router.refresh();
    } catch (e: any) {
      setErr(e.message || "Login gagal");
      // Hilangkan notifikasi error setelah 3 detik
      setTimeout(() => setErr(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: {
          // opsional agar selalu dapat refresh_token
          access_type: "offline",
          prompt: "consent",
        },
      },
    });
  };
  

  return (
    <main className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* Kiri: RAG Document AI Illustration - Full Column */}
      <div className="hidden md:flex items-center justify-center bg-gradient-to-br from-primary/10 via-accent/5 to-background relative overflow-hidden p-8">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-32 h-32 border-2 border-primary/20 rounded-lg rotate-12"></div>
          <div className="absolute top-32 right-16 w-24 h-24 border-2 border-accent/20 rounded-lg -rotate-12"></div>
          <div className="absolute bottom-20 left-20 w-28 h-28 border-2 border-primary/20 rounded-lg rotate-45"></div>
          <div className="absolute bottom-32 right-10 w-20 h-20 border-2 border-accent/20 rounded-lg -rotate-45"></div>
        </div>
        
        {/* AI Brain Icon */}
        <div className="absolute top-16 left-16">
          <div className="w-20 h-20 bg-gradient-to-br from-primary to-accent rounded-full flex items-center justify-center shadow-2xl">
            <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
          </div>
        </div>
        
        {/* Document Icons - Scattered */}
        <div className="absolute top-24 right-20">
          <div className="w-16 h-20 bg-white/90 rounded-lg shadow-lg flex items-center justify-center transform rotate-12 hover:rotate-0 transition-transform duration-500">
            <svg className="w-8 h-8 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
          </div>
        </div>
        
        <div className="absolute bottom-32 left-20">
          <div className="w-14 h-18 bg-white/90 rounded-lg shadow-lg flex items-center justify-center transform -rotate-6 hover:rotate-0 transition-transform duration-500">
            <svg className="w-7 h-7 text-accent" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
          </div>
        </div>
        
        <div className="absolute bottom-20 right-16">
          <div className="w-12 h-16 bg-white/90 rounded-lg shadow-lg flex items-center justify-center transform rotate-8 hover:rotate-0 transition-transform duration-500">
            <svg className="w-6 h-6 text-primary" fill="currentColor" viewBox="0 0 24 24">
              <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z"/>
            </svg>
          </div>
        </div>
        
        {/* Connection Lines - Dynamic */}
        <div className="absolute top-32 left-1/2 transform -translate-x-1/2">
          <div className="flex items-center space-x-4">
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
            <div className="w-16 h-1 bg-gradient-to-r from-primary to-accent rounded-full"></div>
            <div className="w-3 h-3 bg-accent rounded-full animate-pulse"></div>
            <div className="w-16 h-1 bg-gradient-to-r from-accent to-primary rounded-full"></div>
            <div className="w-3 h-3 bg-primary rounded-full animate-pulse"></div>
          </div>
        </div>
        
        {/* Main Text - Centered */}
        <div className="text-center z-10">
          <h2 className="text-4xl font-bold mb-4" style={{
            background: 'linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%)',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent'
          }}>RAG Document AI</h2>
          <p className="text-lg text-muted-foreground leading-relaxed max-w-md">
            Upload dokumen, analisis dengan AI, dan dapatkan jawaban yang akurat dari konten Anda
          </p>
        </div>
      </div>

      {/* Kanan: form */}
      <div className="flex items-center justify-center bg-gradient-to-b from-background to-muted/40 p-8">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-semibold text-center mb-8">Log In</h1>

          <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
            {/* autofill trap */}
            <input type="text" name="username" autoComplete="username" className="hidden" aria-hidden="true" tabIndex={-1} />
            <input type="password" name="password" autoComplete="current-password" className="hidden" aria-hidden="true" tabIndex={-1} />

            <div className="space-y-1">
              <label className="text-sm">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email"
                name="login_email"
                autoComplete="off"
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="space-y-1">
              <label className="text-sm">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  name="login_password"
                  autoComplete="off"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  aria-label="toggle password"
                >
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="accent-primary"
                  />
                  Remember me
                </label>

                {/* ⬇️ ganti alert → link ke halaman forgot-password */}
                <button
                  type="button"
                  className="text-xs text-gradient hover:underline"
                  onClick={() => router.push("/forgot-password")}
                >
                  Forgot Password?
                </button>
              </div>
            </div>

            {err && (
              <div className="text-sm text-red-500 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
                {err}
              </div>
            )}
            {success && (
              <div className="text-sm text-emerald-500 border border-emerald-500/30 bg-emerald-500/10 rounded-md px-3 py-2">
                {success}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md btn-gradient py-2 text-sm font-medium hover:brightness-105 disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Log In"}
            </button>

            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px bg-border" />
              <span>or</span>
              <div className="h-px bg-border" />
            </div>

            <button
              type="button"
              onClick={loginWithGoogle}
              className="w-full rounded-md border border-border bg-background py-2 text-sm hover:bg-muted/40"
            >
              <span className="inline-flex items-center gap-2">
                <Image src="/g.png" alt="Google" width={18} height={18} />
                Continue with Google
              </span>
            </button>
          </form>

          <p className="text-xs text-muted-foreground mt-6 text-center">
            No account yet?{" "}
            <a className="text-gradient hover:underline" href={`/register?next=${encodeURIComponent(next)}`}>
              Sign Up
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
