import { and, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { products } from "@/db/schema";
import { getCurrentUserStore } from "@/lib/auth";

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { user, store } = await getCurrentUserStore();
  if (!user) redirect("/login");
  if (!store) redirect("/dashboard");

  const { id } = await params;

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.storeId, store.id)))
    .limit(1);

  if (!product) notFound();

  async function updateProduct(formData: FormData) {
    "use server";

    const productId = String(formData.get("productId") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const price = Number(formData.get("price") ?? 0);
    const inventory = Number(formData.get("inventory") ?? 0);
    const imageUrl = String(formData.get("imageUrl") ?? "").trim();

    if (!productId || !title || !description || price <= 0 || inventory < 0) {
      redirect(`/dashboard/products/${id}?error=1`);
    }

    await db
      .update(products)
      .set({
        title,
        description,
        priceCents: Math.round(price * 100),
        inventory,
        imageUrl: imageUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));

    redirect("/dashboard");
  }

  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10">
      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-black text-slate-950">Edit Product</h1>
          <Link href="/dashboard" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
            Back
          </Link>
        </div>

        <form action={updateProduct} className="mt-6 space-y-4">
          <input type="hidden" name="productId" value={product.id} />
          <div>
            <label htmlFor="title">Title</label>
            <input id="title" name="title" defaultValue={product.title} required />
          </div>
          <div>
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" rows={5} defaultValue={product.description} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="price">Price (USD)</label>
              <input id="price" name="price" type="number" min="0.01" step="0.01" defaultValue={(product.priceCents / 100).toFixed(2)} required />
            </div>
            <div>
              <label htmlFor="inventory">Inventory</label>
              <input id="inventory" name="inventory" type="number" min="0" defaultValue={product.inventory} required />
            </div>
          </div>
          <div>
            <label htmlFor="imageUrl">Image URL</label>
            <input id="imageUrl" name="imageUrl" defaultValue={product.imageUrl ?? ""} />
          </div>
          <button type="submit" className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500">
            Save Changes
          </button>
        </form>
      </section>
    </main>
  );
}
