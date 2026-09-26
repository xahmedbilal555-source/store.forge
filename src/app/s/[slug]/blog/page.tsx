import Link from "next/link";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, stores } from "@/db/schema";
import { formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function StoreBlogPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const [store] = await db.select().from(stores).where(eq(stores.slug, slug)).limit(1);
  if (!store) notFound();

  const posts = await db
    .select()
    .from(blogPosts)
    .where(and(eq(blogPosts.storeId, store.id), eq(blogPosts.isPublished, true)))
    .orderBy(desc(blogPosts.createdAt));

  return (
    <main className="mx-auto w-full max-w-4xl px-4 py-10">
      <h1 className="text-3xl font-black text-slate-950">{store.name} Blog</h1>
      <div className="mt-6 space-y-4">
        {posts.length === 0 ? (
          <p className="text-slate-600">No posts yet.</p>
        ) : (
          posts.map((post) => (
            <Link key={post.id} href={`/s/${slug}/blog/${post.slug}`} className="block rounded-2xl border border-slate-200 bg-white p-5 hover:bg-slate-50">
              <p className="text-xs text-slate-500">{formatDate(post.createdAt)}</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">{post.title}</h2>
              <p className="mt-1 text-sm text-slate-600">{post.excerpt}</p>
            </Link>
          ))
        )}
      </div>
    </main>
  );
}
