// app/forgot-password/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const supabase = createClient();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setOk(null);
    setLoading(true);

    try {
      // Pastikan email tidak kosong
      if (!email || !email.trim()) {
        setErr("Email tidak boleh kosong");
        setLoading(false);
        return;
      }

      // Pastikan format email valid
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setErr("Format email tidak valid");
        setLoading(false);
        return;
      }

      // Gunakan window.location.origin untuk konsistensi
      const redirectUrl = typeof window !== 'undefined' 
        ? `${window.location.origin}/reset-password`
        : `${location.origin}/reset-password`;

      console.log('🔄 Requesting password reset for:', email);
      console.log('📍 Redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: redirectUrl,
      });

      if (error) {
        console.error('❌ Supabase error:', error);
        // Tampilkan error yang lebih informatif
        if (error.message.includes('rate limit')) {
          setErr("Terlalu banyak permintaan. Silakan coba lagi nanti.");
        } else if (error.message.includes('email')) {
          setErr("Email tidak ditemukan atau tidak valid.");
        } else if (error.message.includes('redirect')) {
          setErr("URL redirect tidak dikonfigurasi. Silakan hubungi administrator.");
        } else {
          setErr(error.message || "Gagal mengirim link reset password. Pastikan email terdaftar.");
        }
        return;
      }

      console.log('✅ Password reset email sent successfully');
      setOk("Link reset password sudah dikirim ke email Anda. Silakan cek inbox atau folder spam.");
    } catch (e: any) {
      console.error('❌ Unexpected error:', e);
      setErr(e.message || "Terjadi kesalahan. Silakan coba lagi atau hubungi administrator.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/40 p-6">
      <div className="w-full max-w-md bg-background border border-border rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-semibold text-center">
          Forgotten your password?
        </h1>
        <p className="text-sm text-muted-foreground text-center mt-1 mb-6">
          We will send a message to reset your password.
        </p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1">
            <label className="text-sm" htmlFor="email">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter personal or work email address"
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
            />
          </div>

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

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-foreground text-background py-2 text-sm font-medium hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Sending..." : "Send Reset Link"}
          </button>
        </form>
      </div>
    </main>
  );
}
