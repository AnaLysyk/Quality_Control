import { NextResponse } from "next/server";
import { authenticateRequest, requireUserRecord } from "@/lib/jwtAuth";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await authenticateRequest(request);
  const user = await requireUserRecord(auth);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = getSupabaseAdmin();
  const form = await request.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Arquivo não enviado" }, { status: 400 });

  const ext = file.name?.split(".").pop() || "jpg";
  const path = `${user.id}/avatar.${ext}`;

  const { error: uploadError } = await supabaseAdmin.storage.from("avatars").upload(path, file, {
    upsert: true,
    contentType: file.type || "image/jpeg",
  });
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 400 });

  const { data } = supabaseAdmin.storage.from("avatars").getPublicUrl(path);
  const avatarUrl = data.publicUrl;

  await supabaseAdmin.from("profiles").update({ avatar_url: avatarUrl }).eq("id", user.id);

  return NextResponse.json({ avatarUrl });
}
