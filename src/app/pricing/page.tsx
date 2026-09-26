import Link from "next/link";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { ensurePlatformBootstrap } from "@/lib/bootstrap";
import { formatCurrency } from "@/lib/utils";
import { SiteHeader } from "@/components/site-header";
import { PageShell } from "@/components/page-shell";
import { getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await ensurePlatformBootstrap();
  const resolvedSearchParams = await searchParams;
  const lang = getLang(typeof resolvedSearchParams.lang === "string" ? resolvedSearchParams.lang : undefined);
  const availablePlans = await db.select().from(plans);

  return (
    <div>
      <SiteHeader lang={lang} />
      <PageShell>
        <h1 className="text-3xl font-black text-slate-950">Choose a Plan That Grows With You</h1>
        <p className="mt-2 max-w-2xl text-slate-600">Upgrade anytime. All plans include secure checkout, product management, and mobile-ready storefronts.</p>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {availablePlans.map((plan) => (
            <article key={plan.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-950">{plan.name}</h2>
              <p className="mt-2 text-3xl font-black text-blue-600">{formatCurrency(plan.monthlyPriceCents)}</p>
              <p className="text-sm text-slate-500">per month</p>
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                <li>• Up to {plan.productLimit} products</li>
                <li>• {plan.advancedAnalytics ? "Advanced analytics" : "Basic analytics"}</li>
                <li>• {plan.customDomain ? "Custom domain support" : "Subdomain only"}</li>
              </ul>
              <Link href="/signup" className="mt-6 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
                Start Free Trial
              </Link>
            </article>
          ))}
        </div>
      </PageShell>
    </div>
  );
}
