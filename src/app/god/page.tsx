import Link from "next/link";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { plans, storeSubscriptions, stores } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { toSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function GodLandingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/god-login");
  if (user.role !== "admin") redirect("/dashboard");

  const [myStore, allPlans] = await Promise.all([
    db.select().from(stores).where(eq(stores.ownerUserId, user.id)).limit(1).then((rows) => rows[0] ?? null),
    db.select().from(plans),
  ]);

  async function createTestStoreAction(formData: FormData) {
    "use server";

    const currentUser = await getCurrentUser();
    if (!currentUser || currentUser.role !== "admin") {
      redirect("/god-login");
    }

    const storeName = String(formData.get("storeName") ?? "").trim() || "Ahmed Test Store";
    const slugBase = toSlug(storeName) || `store-${Date.now()}`;

    let slug = slugBase;
    let step = 1;

    while (true) {
      const [existing] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
      if (!existing) break;
      step += 1;
      slug = `${slugBase}-${step}`;
    }

    const [createdStore] = await db
      .insert(stores)
      .values({
        ownerUserId: currentUser.id,
        name: storeName,
        slug,
        primaryColor: "#2563eb",
        theme: "modern",
        language: "en",
      })
      .returning();

    const [proPlan] = await db.select().from(plans).where(eq(plans.code, "pro")).limit(1);
    if (proPlan) {
      await db.insert(storeSubscriptions).values({
        storeId: createdStore.id,
        planId: proPlan.id,
        status: "active",
        paymentProvider: "god_access",
        paymentReference: `GOD-FREE-${Date.now()}`,
        renewsAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      });
    }

    redirect("/god?created=1");
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-10">
      <section className="rounded-3xl bg-slate-950 px-6 py-10 text-white sm:px-10">
        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-blue-200">God access</p>
        <h1 className="mt-2 text-4xl font-black">God User Landing</h1>
        <p className="mt-2 text-sm text-slate-300">Use this page to test every part of the platform quickly.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/" className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-blue-100">Home</Link>
          <Link href="/admin" className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Admin Panel</Link>
          <Link href="/dashboard" className="rounded-full border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10">Store Dashboard</Link>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-950">Store Owner Feature Testing</h2>
        {myStore ? (
          <div className="mt-3 rounded-xl bg-green-50 p-4">
            <p className="text-sm font-semibold text-green-800">Store ready: {myStore.name}</p>
            <p className="text-xs text-green-700">You can now test products, orders, customers, blog, and plan flows in dashboard.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/dashboard" className="rounded-full bg-green-700 px-4 py-2 text-xs font-semibold text-white hover:bg-green-600">Open Dashboard</Link>
              <Link href={`/s/${myStore.slug}`} className="rounded-full border border-green-600 px-4 py-2 text-xs font-semibold text-green-700 hover:bg-green-100">Open Storefront</Link>
            </div>
          </div>
        ) : (
          <form action={createTestStoreAction} className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4">
            <label htmlFor="storeName">Create instant test store</label>
            <input id="storeName" name="storeName" placeholder="Ahmed Test Store" required />
            <button type="submit" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              Create Test Store (Free)
            </button>
          </form>
        )}
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-950">Plans Available</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {allPlans.map((plan) => (
            <article key={plan.id} className="rounded-xl border border-slate-200 p-4">
              <p className="font-semibold text-slate-900">{plan.name}</p>
              <p className="text-sm text-slate-600">{(plan.monthlyPriceCents / 100).toFixed(2)} USD/mo</p>
              <p className="text-xs text-slate-500">Limit: {plan.productLimit}</p>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
