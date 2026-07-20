import { NextResponse } from "next/server";
import { withRoute } from "@/lib/api/route";
import { clearCookieOptions } from "@/lib/auth";

async function _POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearCookieOptions());
  return res;
}

export const POST = withRoute(_POST);
