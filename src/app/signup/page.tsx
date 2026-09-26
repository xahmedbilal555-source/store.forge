import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, storeSubscriptions, stores, users } from "@/db/schema";
import { ensurePlatformBootstrap } from "@/lib/bootstrap";
import { hashPassword, setSession } from "@/lib/auth";
import { toSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await ensurePlatformBootstrap();
  const resolvedSearchParams = await searchParams;
  const error = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : "";

  async function signupAction(formData: FormData) {
    "use server";

    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");
    const storeName = String(formData.get("storeName") ?? "").trim();

    if (!fullName || !email || !password || !storeName || password.length < 8) {
      redirect("/signup?error=invalid");
    }

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (existing) {
      redirect("/signup?error=email");
    }

    const slugBase = toSlug(storeName) || `store-${Date.now()}`;
    let slug = slugBase;
    let attempt = 1;

    while (true) {
      const [existingStore] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
      if (!existingStore) break;
      attempt += 1;
      slug = `${slugBase}-${attempt}`;
    }

    const [user] = await db
      .insert(users)
      .values({
        fullName,
        email,
        passwordHash: hashPassword(password),
      })
      .returning();

    const [store] = await db
      .insert(stores)
      .values({
        ownerUserId: user.id,
        name: storeName,
        slug,
      })
      .returning();

    const [basicPlan] = await db.select().from(plans).where(eq(plans.code, "basic")).limit(1);

    if (basicPlan) {
      await db.insert(storeSubscriptions).values({
        storeId: store.id,
        planId: basicPlan.id,
        status: "trial",
      });
    }

    await setSession(user.id);
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-10">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-black text-slate-950">Create your store</h1>
        <p className="mt-1 text-sm text-slate-600">Start your free trial in minutes.</p>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">Please check your details and try again.</p>}
        <form action={signupAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="fullName">Full name</label>
            <input id="fullName" name="fullName" required />
          </div>
          <div>
            <label htmlFor="email">Email</label>
            <input id="email" name="email" type="email" required />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" minLength={8} required />
          </div>
          <div>
            <label htmlFor="storeName">Store name</label>
            <input id="storeName" name="storeName" required />
          </div>
          <button className="w-full rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500" type="submit">
            Start Free Trial
          </button>
        </form>
        <div className="mt-4 text-center text-sm text-slate-600">
          Already have an account? <Link className="font-semibold text-blue-600" href="/login">Log in</Link>
        </div>
      </section>
    </main>
  );
}
