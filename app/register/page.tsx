// app/register/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Image from "next/image";

export default function RegisterPage() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [agree, setAgree] = useState(false);

  const [showPw, setShowPw] = useState(false);
  const [showPw2, setShowPw2] = useState(false);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // ===== Kurangi efek autofill: paksa state kosong saat halaman mount
  useEffect(() => {
    setUsername("");
    setEmail("");
    setPassword("");
    setConfirm("");
  }, []);

  const mismatch = confirm.length > 0 && confirm !== password;

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);

    // validasi dasar
    if (!agree) {
      setErr("Harap centang persetujuan terlebih dahulu.");
      return;
    }
    if (password.length < 6) {
      setErr("Password minimal 6 karakter.");
      return;
    }
    if (password !== confirm) {
      setErr("Password dan konfirmasi tidak cocok.");
      return;
    }

    setLoading(true);
    try {
      // PENTING: pakai client-side signUp agar email verifikasi terkirim
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { username, full_name: username, name: username },
          // pastikan URL ini ada di Auth → URL Configuration → Redirect URLs
          emailRedirectTo: `${location.origin}/auth/callback?type=signup&next=${encodeURIComponent(
            next
          )}`,
        },
      });

      if (error) throw error;

      // Pada mode email confirmation, user belum login.
      setOk(
        "Akun berhasil dibuat. Silakan cek email untuk verifikasi sebelum login."
      );
      // Hilangkan notifikasi setelah 3 detik
      setTimeout(() => setOk(null), 3000);

      // Arahkan ke /login biar user langsung coba login setelah verifikasi
      setTimeout(() => {
        router.replace(`/login?next=${encodeURIComponent(next)}`);
      }, 1800);
    } catch (e: any) {
      setErr(e?.message || "Sign up gagal");
      // Hilangkan notifikasi error setelah 3 detik
      setTimeout(() => setErr(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const registerWithGoogle = async () => {
    setErr(null);
    setOk(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  };

  return (
    <main className="min-h-screen grid grid-cols-1 md:grid-cols-2">
      {/* kiri: RAG Document AI Illustration - Full Column */}
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
            Bergabunglah dan mulai analisis dokumen cerdas dengan teknologi AI terdepan
          </p>
        </div>
      </div>

      {/* kanan: form */}
      <div className="flex items-center justify-center bg-gradient-to-b from-background to-muted/40 p-8">
        <div className="w-full max-w-md">
          <h1 className="text-3xl font-semibold text-center mb-8">Sign Up</h1>

          <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
            {/* ===== Autofill trap: biar Chrome isi di sini, bukan field kita ===== */}
            <input
              type="text"
              name="trap-username"
              autoComplete="username"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />
            <input
              type="password"
              name="trap-password"
              autoComplete="new-password"
              className="hidden"
              aria-hidden="true"
              tabIndex={-1}
            />

            {/* USERNAME */}
            <div className="space-y-1">
              <label className="text-sm" htmlFor="username">
                Username
              </label>
              <input
                id="username"
                name="reg_username" // nama unik untuk menghindari autofill
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* EMAIL */}
            <div className="space-y-1">
              <label className="text-sm" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                name="reg_email" // nama unik
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            {/* PASSWORD */}
            <div className="space-y-1">
              <label className="text-sm" htmlFor="password">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="reg_password"
                  type={showPw ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="password"
                  autoComplete="new-password"
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
            </div>

            {/* CONFIRM PASSWORD */}
            <div className="space-y-1">
              <label className="text-sm" htmlFor="confirm">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="confirm"
                  name="reg_confirm_password"
                  type={showPw2 ? "text" : "password"}
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="confirm password"
                  autoComplete="new-password"
                  className={`w-full rounded-md border px-3 py-2 text-sm outline-none pr-10 ${
                    mismatch
                      ? "border-red-500 focus:ring-red-400"
                      : "border-border bg-background focus:ring-2 focus:ring-primary/40"
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPw2((s) => !s)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  aria-label="toggle confirm password"
                >
                  {showPw2 ? "🙈" : "👁️"}
                </button>
              </div>
              {mismatch && (
                <p className="text-xs text-red-500 mt-1">
                  Konfirmasi password tidak cocok.
                </p>
              )}
            </div>

            {/* AGREEMENT */}
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={agree}
                onChange={(e) => setAgree(e.target.checked)}
                className="accent-primary"
              />
              Saya setuju dengan syarat & kebijakan
            </label>

            {/* ALERTS */}
            {err && (
              <div className="text-sm text-red-500 border border-red-500/30 bg-red-500/10 rounded-md px-3 py-2">
                {err}
              </div>
            )}
            {ok && (
              <div className="text-sm text-emerald-500 border border-emerald-500/30 bg-emerald-500/10 rounded-md px-3 py-2">
                {ok}
              </div>
            )}

            {/* SUBMIT */}
            <button
              type="submit"
              disabled={loading || mismatch}
              className="w-full rounded-md btn-gradient py-2 text-sm font-medium hover:brightness-105 disabled:opacity-60"
            >
              {loading ? "Creating..." : "Create account"}
            </button>

            {/* OR */}
            <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs text-muted-foreground">
              <div className="h-px bg-border" />
              <span>or</span>
              <div className="h-px bg-border" />
            </div>

            {/* GOOGLE */}
            <button
              type="button"
              onClick={registerWithGoogle}
              className="w-full rounded-md border border-border bg-background py-2 text-sm hover:bg-muted/40"
            >
              <span className="inline-flex items-center gap-2">
                <Image src="/g.png" alt="Google" width={18} height={18} />
                Sign up with Google
              </span>
            </button>

            {/* LINK TO LOGIN */}
            <p className="text-xs text-muted-foreground mt-6 text-center">
              Sudah punya akun?{" "}
              <a
                className="text-gradient hover:underline"
                href={`/login?next=${encodeURIComponent(next)}`}
              >
                Log In
              </a>
            </p>
          </form>
        </div>
      </div>
    </main>
  );
}
