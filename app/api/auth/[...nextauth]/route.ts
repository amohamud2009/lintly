import { NextRequest, NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export async function GET(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
  if (req.nextUrl.searchParams.has("iss")) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("iss");
    return NextResponse.redirect(url);
  }
  return handler(req, ctx);
}

export async function POST(req: NextRequest, ctx: { params: { nextauth: string[] } }) {
  return handler(req, ctx);
}
