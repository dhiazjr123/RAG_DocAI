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
      {/* Kiri: illustration */}
      <div className="hidden md:flex items-center justify-center relative overflow-hidden p-10 bg-gradient-to-br from-[#0b0c1a] via-[#0d1024] to-[#0b0c1a]">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_20%_20%,rgba(80,99,255,0.15),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(99,102,241,0.18),transparent_32%),radial-gradient(circle_at_30%_80%,rgba(56,189,248,0.14),transparent_30%)]" />

        <Image
          src="/3.png"
          alt="Brain document icon"
          width={150}
          height={150}
          className="absolute top-6 left-6 w-28 h-28 object-contain drop-shadow-xl"
          priority
        />
        <Image
          src="/2.png"
          alt="Search document icon"
          width={170}
          height={170}
          className="absolute top-10 right-10 w-32 h-32 object-contain drop-shadow-xl"
          priority
        />
        <Image
          src="/4.png"
          alt="Book to brain icon"
          width={170}
          height={170}
          className="absolute bottom-14 left-10 w-32 h-32 object-contain drop-shadow-lg"
          priority
        />
        <Image
          src="/1.png"
          alt="Flow icon"
          width={190}
          height={190}
          className="absolute bottom-10 right-10 w-40 h-40 object-contain drop-shadow-lg"
          priority
        />

        <div className="text-center z-10 space-y-4">
          <div className="flex items-center justify-center gap-3">
            <span className="h-2.5 w-2.5 rounded-full bg-primary/80"></span>
            <span className="h-1 w-16 rounded-full bg-primary/60"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-muted"></span>
            <span className="h-1 w-16 rounded-full bg-primary/60"></span>
            <span className="h-2.5 w-2.5 rounded-full bg-primary/80"></span>
          </div>
          <h2
            className="text-4xl font-bold"
            style={{
              background:
                "linear-gradient(135deg, #6ea0ff 0%, #5372ff 50%, #6ad0ff 100%)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            RAG Dokumen AI
          </h2>
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
              className="w-full rounded-md btn-gradient btn-press py-2 text-sm font-medium hover:brightness-105 disabled:opacity-60"
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
