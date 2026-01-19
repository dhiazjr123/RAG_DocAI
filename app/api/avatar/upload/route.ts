/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { BUCKET } from "@/lib/supabase";
import { createServerSupabase } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user
    const supabaseServer = createServerSupabase();
    const { data: { user }, error: authError } = await supabaseServer.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // Get file from FormData
    const form = await req.formData();
    const file: any = form.get("file");
    
    if (!file || typeof file.arrayBuffer !== "function" || !file.name) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, PNG, GIF, and WebP are allowed." }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size too large. Maximum 5MB allowed." }, { status: 400 });
    }

    // Convert file to buffer
    const buf = Buffer.from(await file.arrayBuffer());
    const ext = (file.name as string).split(".").pop()?.toLowerCase() || "jpg";
    const storageKey = `${userId}/avatar_${Date.now()}.${ext}`;

    // Use admin client for storage operations (has permission to create buckets)
    const adminClient = supabaseAdmin();

    // Check if bucket exists, create if not (using admin client)
    const { data: buckets, error: listError } = await adminClient.storage.listBuckets();
    
    if (!listError && buckets) {
      const bucketExists = buckets.some((b: any) => b.name === BUCKET);
      
      if (!bucketExists) {
        // Try to create bucket (only works with service role key)
        const { error: createError } = await adminClient.storage.createBucket(BUCKET, {
          public: true,
          allowedMimeTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        });
        
        if (createError) {
          console.warn("Could not create bucket:", createError.message);
          // Continue anyway, might already exist
        }
      }
    }

    // Upload to Supabase Storage using admin client
    const { error: uploadError } = await adminClient.storage
      .from(BUCKET)
      .upload(storageKey, buf, {
        contentType: file.type || "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      console.error("Error uploading avatar:", uploadError);
      
      // Provide helpful error message if bucket not found
      if (uploadError.message.includes("not found") || uploadError.message.includes("Bucket not found")) {
        return NextResponse.json(
          { 
            error: `Bucket "${BUCKET}" tidak ditemukan di Supabase Storage. Silakan buat bucket "${BUCKET}" di Supabase Dashboard > Storage terlebih dahulu.` 
          },
          { status: 500 }
        );
      }
      
      return NextResponse.json(
        { error: `Failed to upload avatar: ${uploadError.message}` },
        { status: 500 }
      );
    }

    // Get public URL using admin client
    const { data: urlData } = adminClient.storage
      .from(BUCKET)
      .getPublicUrl(storageKey);

    const publicUrl = urlData.publicUrl;

    return NextResponse.json({ 
      success: true, 
      url: publicUrl,
      storageKey 
    }, { status: 200 });

  } catch (error: any) {
    console.error("Error in avatar upload:", error);
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    );
  }
}
