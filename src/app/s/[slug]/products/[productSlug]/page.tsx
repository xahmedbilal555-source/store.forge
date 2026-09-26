import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { products, stores } from "@/db/schema";
import { formatCurrency } from "@/lib/utils";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { slug, productSlug } = await params;

  const result = await db
    .select({
      title: products.title,
      description: products.description,
      storeName: stores.name,
    })
    .from(products)
    .innerJoin(stores, eq(stores.id, products.storeId))
    .where(and(eq(stores.slug, slug), eq(products.slug, productSlug)))
    .limit(1);

  const item = result[0];
  if (!item) {
    return { title: "Product not found" };
  }

  return {
    title: `${item.title} | ${item.storeName}`,
    description: item.description.slice(0, 150),
  };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;

  const result = await db
    .select({
      id: products.id,
      title: products.title,
      description: products.description,
      imageUrl: products.imageUrl,
      priceCents: products.priceCents,
      inventory: products.inventory,
      storeName: stores.name,
      storeSlug: stores.slug,
    })
    .from(products)
    .innerJoin(stores, eq(stores.id, products.storeId))
    .where(and(eq(stores.slug, slug), eq(products.slug, productSlug), eq(products.isPublished, true)))
    .limit(1);

  const product = result[0];
  if (!product) notFound();

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{product.storeName}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">{product.title}</h1>
        <p className="mt-4 text-sm leading-7 text-slate-700">{product.description}</p>
        <p className="mt-6 text-3xl font-black text-blue-600">{formatCurrency(product.priceCents)}</p>
        <p className="mt-1 text-sm text-slate-500">Inventory: {product.inventory}</p>
        <a href={`/s/${product.storeSlug}`} className="mt-6 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Back to Store
        </a>
      </article>
    </main>
  );
}
