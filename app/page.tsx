// app/page.tsx  (SERVER COMPONENT)
import { redirect } from "next/navigation";
import HomeShell from "@/components/home-shell";
import { createServerSupabase } from "@/lib/supabase/server";

export default async function Page() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.auth.getUser();
    
    // Log untuk debugging
    console.log('Auth check result:', { user: data?.user?.id, error });
    
    if (error) {
      console.error('Auth error:', error);
      redirect("/login?next=/");
    }
    
    if (!data?.user) {
      console.log('No user found, redirecting to login');
      redirect("/login?next=/");
    }
    
    console.log('User authenticated:', data.user.email);
  } catch (error) {
    console.error('Page load error:', error);
    // Kalau fetch Supabase time-out/ gagal, arahkan ke login daripada crash
    redirect("/login?next=/");
  }

  return <HomeShell />;
}
