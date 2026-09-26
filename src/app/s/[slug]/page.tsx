import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, products, stores } from "@/db/schema";
import { formatCurrency, formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function StorefrontPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [store] = await db
    .select()
    .from(stores)
    .where(and(eq(stores.slug, slug), eq(stores.status, "active")))
    .limit(1);

  if (!store) notFound();

  const [storeProducts, storePosts] = await Promise.all([
    db
      .select()
      .from(products)
      .where(and(eq(products.storeId, store.id), eq(products.isPublished, true)))
      .orderBy(desc(products.createdAt)),
    db
      .select()
      .from(blogPosts)
      .where(and(eq(blogPosts.storeId, store.id), eq(blogPosts.isPublished, true)))
      .orderBy(desc(blogPosts.createdAt)),
  ]);

  return (
    <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-3xl bg-slate-950 px-6 py-12 text-white">
        <p className="text-sm uppercase tracking-[0.12em] text-blue-200">Storefront</p>
        <h1 className="mt-2 text-4xl font-black">{store.name}</h1>
        <p className="mt-2 text-sm text-slate-300">Theme: {store.theme} · Accent: {store.primaryColor}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-black text-slate-950">Products</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {storeProducts.length === 0 ? (
            <p className="text-slate-600">No products yet.</p>
          ) : (
            storeProducts.map((product) => (
              <article key={product.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-lg font-bold text-slate-950">{product.title}</p>
                <p className="mt-1 text-sm text-slate-600 line-clamp-2">{product.description}</p>
                <p className="mt-3 text-xl font-black text-blue-600">{formatCurrency(product.priceCents)}</p>
                <Link href={`/s/${store.slug}/products/${product.slug}`} className="mt-4 inline-flex text-sm font-semibold text-slate-900 hover:text-blue-600">
                  View details →
                </Link>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-black text-slate-950">From the Blog</h2>
          <Link href={`/s/${store.slug}/blog`} className="text-sm font-semibold text-blue-600 hover:text-blue-500">See all</Link>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {storePosts.slice(0, 4).map((post) => (
            <Link key={post.id} href={`/s/${store.slug}/blog/${post.slug}`} className="rounded-2xl border border-slate-200 bg-white p-4 hover:bg-slate-50">
              <p className="text-xs text-slate-500">{formatDate(post.createdAt)}</p>
              <p className="mt-1 text-lg font-bold text-slate-950">{post.title}</p>
              <p className="mt-1 text-sm text-slate-600">{post.excerpt}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
