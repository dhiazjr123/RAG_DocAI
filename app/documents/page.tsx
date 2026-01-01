// app/documents/page.tsx
import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import DocumentsPageShell from "@/components/documents-page-shell";

export default async function DocumentsPage() {
  try {
    const supabase = createServerSupabase();
    const { data, error } = await supabase.auth.getUser();
    
    if (error || !data?.user) {
      redirect("/login?next=/documents");
    }
  } catch (error) {
    redirect("/login?next=/documents");
  }

  return <DocumentsPageShell />;
}

