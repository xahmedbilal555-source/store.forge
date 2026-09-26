import { and, eq, isNull, ne, or } from "drizzle-orm";
import { db } from "@/db";
import { hashPassword } from "@/lib/auth";
import { GOD_EMAIL, GOD_PASSWORD, GOD_USERNAME } from "@/lib/god-account";
import { plans, users } from "@/db/schema";

const defaultPlans = [
  {
    code: "basic",
    name: "Basic",
    monthlyPriceCents: 1900,
    productLimit: 25,
    advancedAnalytics: false,
    customDomain: false,
  },
  {
    code: "pro",
    name: "Pro",
    monthlyPriceCents: 4900,
    productLimit: 300,
    advancedAnalytics: true,
    customDomain: true,
  },
  {
    code: "premium",
    name: "Premium",
    monthlyPriceCents: 9900,
    productLimit: 5000,
    advancedAnalytics: true,
    customDomain: true,
  },
];

let initialized = false;

export async function ensurePlatformBootstrap() {
  if (initialized) return;

  await db.insert(plans).values(defaultPlans).onConflictDoNothing({ target: plans.code });

  await db
    .insert(users)
    .values({
      fullName: "Ahmed (God Account)",
      username: GOD_USERNAME,
      email: GOD_EMAIL,
      passwordHash: hashPassword(GOD_PASSWORD),
      role: "admin",
    })
    .onConflictDoNothing({ target: users.email });

  const [canonicalGodUser] = await db.select().from(users).where(eq(users.email, GOD_EMAIL)).limit(1);

  if (canonicalGodUser) {
    await db
      .update(users)
      .set({
        fullName: "Ahmed (God Account)",
        username: GOD_USERNAME,
        passwordHash: hashPassword(GOD_PASSWORD),
        role: "admin",
      })
      .where(eq(users.id, canonicalGodUser.id));

    await db
      .delete(users)
      .where(
        and(
          ne(users.id, canonicalGodUser.id),
          or(eq(users.username, "ahmed_999"), eq(users.email, "ahmed_999@god.storeforge.local")),
        ),
      );
  }

  await db
    .delete(users)
    .where(and(eq(users.email, "admin@platform.local"), isNull(users.username), eq(users.role, "admin")));

  initialized = true;
}
