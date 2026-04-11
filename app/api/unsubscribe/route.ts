import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/db";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token || token.length < 16) {
    return new NextResponse("Invalid or missing token", { status: 400 });
  }

  const { data, error } = await getSupabase()
    .from("users")
    .update({ digest_enabled: false })
    .eq("unsubscribe_token", token)
    .select("id")
    .single();

  if (error || !data) {
    return new NextResponse("Invalid token", { status: 400 });
  }

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
    <body style="background:#000;color:#e5e5e5;font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;">
      <div style="text-align:center;">
        <h1 style="font-size:24px;font-weight:600;">Unsubscribed</h1>
        <p style="color:#737373;">You won't receive Lintly digest emails anymore.</p>
      </div>
    </body></html>`,
    { headers: { "Content-Type": "text/html" } }
  );
}
