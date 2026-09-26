import Link from "next/link";
import { db } from "@/db";
import { plans, stores } from "@/db/schema";
import { ensurePlatformBootstrap } from "@/lib/bootstrap";
import { formatCurrency } from "@/lib/utils";
import { getLang, text } from "@/lib/i18n";
import { SiteHeader } from "@/components/site-header";
import { PageShell } from "@/components/page-shell";

export const dynamic = "force-dynamic";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await ensurePlatformBootstrap();
  const resolvedSearchParams = await searchParams;
  const lang = getLang(typeof resolvedSearchParams.lang === "string" ? resolvedSearchParams.lang : undefined);
  const t = text[lang];

  const [availablePlans, liveStores] = await Promise.all([
    db.select().from(plans),
    db.select().from(stores),
  ]);

  return (
    <div>
      <SiteHeader lang={lang} />
      <PageShell>
        <section className="rounded-3xl bg-gradient-to-br from-slate-950 to-blue-700 px-6 py-16 text-white sm:px-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-100">Multi-vendor commerce</p>
          <h1 className="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-5xl">{t.headline}</h1>
          <p className="mt-4 max-w-2xl text-base text-blue-100 sm:text-lg">{t.subheadline}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="rounded-full bg-white px-6 py-3 text-sm font-bold text-slate-900 hover:bg-blue-50"
            >
              {t.ctaTrial}
            </Link>
            <Link
              href="/pricing"
              className="rounded-full border border-white/40 px-6 py-3 text-sm font-bold text-white hover:bg-white/10"
            >
              Compare Plans
            </Link>
          </div>
        </section>

        <section className="mt-10 grid gap-4 sm:grid-cols-3">
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Active stores</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{liveStores.length}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Subscription plans</p>
            <p className="mt-2 text-3xl font-black text-slate-950">{availablePlans.length}</p>
          </article>
          <article className="rounded-2xl border border-slate-200 bg-white p-5">
            <p className="text-sm text-slate-500">Store setup time</p>
            <p className="mt-2 text-3xl font-black text-slate-950">&lt; 2 mins</p>
          </article>
        </section>

        <section className="mt-12 rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-2xl font-bold text-slate-950">Pricing Plans</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-600">
                  <th className="px-3 py-3">Plan</th>
                  <th className="px-3 py-3">Price</th>
                  <th className="px-3 py-3">Product Limit</th>
                  <th className="px-3 py-3">Advanced Analytics</th>
                  <th className="px-3 py-3">Custom Domain</th>
                </tr>
              </thead>
              <tbody>
                {availablePlans.map((plan) => (
                  <tr key={plan.id} className="border-b border-slate-100">
                    <td className="px-3 py-3 font-semibold text-slate-900">{plan.name}</td>
                    <td className="px-3 py-3 text-slate-700">{formatCurrency(plan.monthlyPriceCents)}/mo</td>
                    <td className="px-3 py-3 text-slate-700">{plan.productLimit}</td>
                    <td className="px-3 py-3 text-slate-700">{plan.advancedAnalytics ? "Yes" : "No"}</td>
                    <td className="px-3 py-3 text-slate-700">{plan.customDomain ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </PageShell>
    </div>
  );
}
