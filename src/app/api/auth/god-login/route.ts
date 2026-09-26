import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { setSession } from "@/lib/auth";
import { ensurePlatformBootstrap } from "@/lib/bootstrap";
import { GOD_EMAIL, GOD_PASSWORD, GOD_USERNAME } from "@/lib/god-account";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  await ensurePlatformBootstrap();

  const body = (await request.json().catch(() => null)) as
    | {
        username?: string;
        password?: string;
      }
    | null;

  const username = body?.username?.trim() ?? "";
  const password = body?.password ?? "";

  if (username !== GOD_USERNAME || password !== GOD_PASSWORD) {
    return NextResponse.json({ ok: false, error: "Invalid username or password" }, { status: 401 });
  }

  const [user] = await db.select().from(users).where(eq(users.email, GOD_EMAIL)).limit(1);

  if (!user) {
    return NextResponse.json({ ok: false, error: "God account bootstrap failed" }, { status: 500 });
  }

  await setSession(user.id);
  return NextResponse.json({ ok: true, redirectTo: "/god" });
}
