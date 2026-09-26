import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { blogPosts, stores } from "@/db/schema";
import { formatDate } from "@/lib/utils";
import { notFound } from "next/navigation";

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string; postSlug: string }> }) {
  const { slug, postSlug } = await params;

  const result = await db
    .select({
      title: blogPosts.title,
      content: blogPosts.content,
      createdAt: blogPosts.createdAt,
      storeName: stores.name,
      storeSlug: stores.slug,
    })
    .from(blogPosts)
    .innerJoin(stores, eq(stores.id, blogPosts.storeId))
    .where(and(eq(stores.slug, slug), eq(blogPosts.slug, postSlug), eq(blogPosts.isPublished, true)))
    .limit(1);

  const post = result[0];
  if (!post) notFound();

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <article className="rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.14em] text-slate-500">{post.storeName}</p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">{post.title}</h1>
        <p className="mt-2 text-sm text-slate-500">{formatDate(post.createdAt)}</p>
        <div className="prose prose-slate mt-6 max-w-none text-slate-700">
          <p className="whitespace-pre-wrap leading-7">{post.content}</p>
        </div>
        <a href={`/s/${post.storeSlug}/blog`} className="mt-6 inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Back to Blog
        </a>
      </article>
    </main>
  );
}
