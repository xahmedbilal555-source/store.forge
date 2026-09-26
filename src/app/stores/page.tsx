import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { stores } from "@/db/schema";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { getLang } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function StoresPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const lang = getLang(typeof resolvedSearchParams.lang === "string" ? resolvedSearchParams.lang : undefined);

  const allStores = await db.select().from(stores).where(eq(stores.status, "active"));

  return (
    <div>
      <SiteHeader lang={lang} />
      <PageShell>
        <h1 className="text-3xl font-black text-slate-950">Explore Live Stores</h1>
        <p className="mt-2 text-slate-600">Discover brands launched on StoreForge.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {allStores.length === 0 ? (
            <p className="text-slate-600">No stores launched yet.</p>
          ) : (
            allStores.map((store) => (
              <article key={store.id} className="rounded-2xl border border-slate-200 bg-white p-5">
                <h2 className="text-lg font-bold text-slate-950">{store.name}</h2>
                <p className="mt-1 text-sm text-slate-500">/{store.slug}</p>
                <Link href={`/s/${store.slug}`} className="mt-4 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-500">
                  Visit storefront →
                </Link>
              </article>
            ))
          )}
        </div>
      </PageShell>
    </div>
  );
}
