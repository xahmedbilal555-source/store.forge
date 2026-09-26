import Link from "next/link";
import { redirect } from "next/navigation";
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  blogPosts,
  categories,
  customers,
  orderItems,
  orders,
  planPaymentRequests,
  plans,
  productTags,
  products,
  storeSubscriptions,
  stores,
  tags,
} from "@/db/schema";
import { ensurePlatformBootstrap } from "@/lib/bootstrap";
import { getCurrentUserStore } from "@/lib/auth";
import { formatCurrency, formatDate, toSlug } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  await ensurePlatformBootstrap();
  const { user, store } = await getCurrentUserStore();

  if (!user) redirect("/login");
  if (user.role === "admin" && !store) redirect("/god");
  if (!store) redirect("/signup?error=no-store");

  const [allProducts, allCustomers, allOrders, allBlogPosts, allPlans, activeSubscription, recentPlanPaymentRequests] = await Promise.all([
    db.select().from(products).where(eq(products.storeId, store.id)).orderBy(desc(products.createdAt)),
    db.select().from(customers).where(eq(customers.storeId, store.id)).orderBy(desc(customers.createdAt)),
    db.select().from(orders).where(eq(orders.storeId, store.id)).orderBy(desc(orders.createdAt)),
    db.select().from(blogPosts).where(eq(blogPosts.storeId, store.id)).orderBy(desc(blogPosts.createdAt)),
    db.select().from(plans),
    db
      .select({
        id: storeSubscriptions.id,
        planId: storeSubscriptions.planId,
        status: storeSubscriptions.status,
        paymentReference: storeSubscriptions.paymentReference,
        planName: plans.name,
        productLimit: plans.productLimit,
      })
      .from(storeSubscriptions)
      .innerJoin(plans, eq(plans.id, storeSubscriptions.planId))
      .where(eq(storeSubscriptions.storeId, store.id))
      .orderBy(desc(storeSubscriptions.startedAt))
      .limit(1)
      .then((rows) => rows[0] ?? null),
    db
      .select({
        id: planPaymentRequests.id,
        transactionReference: planPaymentRequests.transactionReference,
        status: planPaymentRequests.status,
        amountCents: planPaymentRequests.amountCents,
        createdAt: planPaymentRequests.createdAt,
        planName: plans.name,
      })
      .from(planPaymentRequests)
      .innerJoin(plans, eq(plans.id, planPaymentRequests.planId))
      .where(eq(planPaymentRequests.storeId, store.id))
      .orderBy(desc(planPaymentRequests.createdAt))
      .limit(5),
  ]);

  const paidOrdersTotal = allOrders
    .filter((order) => order.status === "paid" || order.status === "fulfilled")
    .reduce((acc, curr) => acc + curr.totalCents, 0);

  const platformReceiverIban = "PK35SADA0000003335265823";
  const platformAccountTitle = "StoreForge Platform Billing";

  async function updateBranding(formData: FormData) {
    "use server";

    const storeId = String(formData.get("storeId") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const logoUrl = String(formData.get("logoUrl") ?? "").trim();
    const primaryColor = String(formData.get("primaryColor") ?? "#2563eb").trim();
    const theme = String(formData.get("theme") ?? "modern").trim();
    const language = String(formData.get("language") ?? "en").trim();

    if (!storeId || !name) redirect("/dashboard?error=branding");

    await db
      .update(stores)
      .set({
        name,
        logoUrl: logoUrl || null,
        primaryColor,
        theme,
        language,
      })
      .where(eq(stores.id, storeId));

    redirect("/dashboard?saved=branding");
  }

  async function addProduct(formData: FormData) {
    "use server";

    const storeId = String(formData.get("storeId") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const description = String(formData.get("description") ?? "").trim();
    const imageUrl = String(formData.get("imageUrl") ?? "").trim();
    const price = Number(formData.get("price") ?? 0);
    const inventory = Number(formData.get("inventory") ?? 0);
    const categoryName = String(formData.get("categoryName") ?? "").trim();
    const tagsInput = String(formData.get("tags") ?? "").trim();

    if (!storeId || !title || !description || price <= 0) {
      redirect("/dashboard?error=product");
    }

    const [sub] = await db
      .select({ productLimit: plans.productLimit })
      .from(storeSubscriptions)
      .innerJoin(plans, eq(plans.id, storeSubscriptions.planId))
      .where(eq(storeSubscriptions.storeId, storeId))
      .orderBy(desc(storeSubscriptions.startedAt))
      .limit(1);

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(eq(products.storeId, storeId));

    if (sub && count >= sub.productLimit) {
      redirect("/dashboard?error=plan-limit");
    }

    let categoryId: string | null = null;
    if (categoryName) {
      const categorySlug = toSlug(categoryName);
      let [category] = await db
        .select()
        .from(categories)
        .where(and(eq(categories.storeId, storeId), eq(categories.slug, categorySlug)))
        .limit(1);

      if (!category) {
        [category] = await db
          .insert(categories)
          .values({ storeId, name: categoryName, slug: categorySlug })
          .returning();
      }
      categoryId = category.id;
    }

    const productSlugBase = toSlug(title) || `product-${Date.now()}`;
    let productSlug = productSlugBase;
    let step = 1;

    while (true) {
      const [existingProduct] = await db
        .select()
        .from(products)
        .where(and(eq(products.storeId, storeId), eq(products.slug, productSlug)))
        .limit(1);

      if (!existingProduct) break;
      step += 1;
      productSlug = `${productSlugBase}-${step}`;
    }

    const [createdProduct] = await db
      .insert(products)
      .values({
        storeId,
        categoryId,
        title,
        slug: productSlug,
        description,
        priceCents: Math.round(price * 100),
        inventory: Number.isFinite(inventory) ? inventory : 0,
        imageUrl: imageUrl || null,
      })
      .returning();

    const tagNames = tagsInput
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    for (const tagName of tagNames) {
      const tagSlug = toSlug(tagName);
      let [tag] = await db
        .select()
        .from(tags)
        .where(and(eq(tags.storeId, storeId), eq(tags.slug, tagSlug)))
        .limit(1);

      if (!tag) {
        [tag] = await db
          .insert(tags)
          .values({ storeId, name: tagName, slug: tagSlug })
          .returning();
      }

      await db.insert(productTags).values({ productId: createdProduct.id, tagId: tag.id }).onConflictDoNothing();
    }

    redirect("/dashboard?saved=product");
  }

  async function deleteProduct(formData: FormData) {
    "use server";
    const productId = String(formData.get("productId") ?? "");
    if (!productId) redirect("/dashboard");

    await db.delete(products).where(eq(products.id, productId));
    redirect("/dashboard?deleted=product");
  }

  async function addCustomer(formData: FormData) {
    "use server";
    const storeId = String(formData.get("storeId") ?? "");
    const fullName = String(formData.get("fullName") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    if (!storeId || !fullName || !email) redirect("/dashboard?error=customer");

    await db.insert(customers).values({ storeId, fullName, email });
    redirect("/dashboard?saved=customer");
  }

  async function addOrder(formData: FormData) {
    "use server";
    const storeId = String(formData.get("storeId") ?? "");
    const customerId = String(formData.get("customerId") ?? "");
    const productId = String(formData.get("productId") ?? "");
    const quantity = Number(formData.get("quantity") ?? 1);

    if (!storeId || !customerId || !productId || quantity <= 0) redirect("/dashboard?error=order");

    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (!product) redirect("/dashboard?error=order-product");

    const totalCents = product.priceCents * quantity;
    const [newOrder] = await db
      .insert(orders)
      .values({
        storeId,
        customerId,
        totalCents,
        status: "paid",
      })
      .returning();

    await db.insert(orderItems).values({
      orderId: newOrder.id,
      productId: product.id,
      quantity,
      priceCents: product.priceCents,
    });

    await db
      .update(products)
      .set({ inventory: Math.max(0, product.inventory - quantity), updatedAt: new Date() })
      .where(eq(products.id, product.id));

    redirect("/dashboard?saved=order");
  }

  async function addBlogPost(formData: FormData) {
    "use server";
    const storeId = String(formData.get("storeId") ?? "");
    const title = String(formData.get("title") ?? "").trim();
    const excerpt = String(formData.get("excerpt") ?? "").trim();
    const content = String(formData.get("content") ?? "").trim();

    if (!storeId || !title || !excerpt || !content) redirect("/dashboard?error=blog");

    const slugBase = toSlug(title) || `post-${Date.now()}`;
    let slug = slugBase;
    let i = 1;

    while (true) {
      const [existing] = await db
        .select()
        .from(blogPosts)
        .where(and(eq(blogPosts.storeId, storeId), eq(blogPosts.slug, slug)))
        .limit(1);
      if (!existing) break;
      i += 1;
      slug = `${slugBase}-${i}`;
    }

    await db.insert(blogPosts).values({
      storeId,
      title,
      slug,
      excerpt,
      content,
    });

    redirect("/dashboard?saved=blog");
  }

  async function submitPlanPaymentRequest(formData: FormData) {
    "use server";

    const storeId = String(formData.get("storeId") ?? "");
    const planId = Number(formData.get("planId") ?? 0);
    const senderName = String(formData.get("senderName") ?? "").trim();
    const senderIban = String(formData.get("senderIban") ?? "").trim();
    const transactionReference = String(formData.get("transactionReference") ?? "").trim();
    const proofUrl = String(formData.get("proofUrl") ?? "").trim();

    if (!storeId || !planId || !transactionReference) {
      redirect("/dashboard?error=plan-payment");
    }

    const [plan] = await db.select().from(plans).where(eq(plans.id, planId)).limit(1);
    if (!plan) {
      redirect("/dashboard?error=plan-not-found");
    }

    await db.insert(planPaymentRequests).values({
      storeId,
      planId,
      receiverIban: platformReceiverIban,
      accountTitle: platformAccountTitle,
      amountCents: plan.monthlyPriceCents,
      senderName: senderName || null,
      senderIban: senderIban || null,
      transactionReference,
      proofUrl: proofUrl || null,
      status: "pending",
    });

    redirect("/dashboard?saved=plan-payment");
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Store dashboard</p>
          <h1 className="text-3xl font-black text-slate-950">{store.name}</h1>
          <p className="text-sm text-slate-500">/{store.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100" href={`/s/${store.slug}`}>
            View Storefront
          </Link>
          <Link className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700" href="/logout">
            Logout
          </Link>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Products</p>
          <p className="mt-2 text-3xl font-black">{allProducts.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Customers</p>
          <p className="mt-2 text-3xl font-black">{allCustomers.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Orders</p>
          <p className="mt-2 text-3xl font-black">{allOrders.length}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Sales</p>
          <p className="mt-2 text-3xl font-black">{formatCurrency(paidOrdersTotal)}</p>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">Branding</h2>
          <form action={updateBranding} className="mt-4 space-y-3">
            <input type="hidden" name="storeId" value={store.id} />
            <div>
              <label htmlFor="name">Store Name</label>
              <input id="name" name="name" defaultValue={store.name} required />
            </div>
            <div>
              <label htmlFor="logoUrl">Logo URL</label>
              <input id="logoUrl" name="logoUrl" defaultValue={store.logoUrl ?? ""} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="primaryColor">Primary Color</label>
                <input id="primaryColor" name="primaryColor" defaultValue={store.primaryColor} />
              </div>
              <div>
                <label htmlFor="theme">Theme</label>
                <select id="theme" name="theme" defaultValue={store.theme}>
                  <option value="modern">Modern</option>
                  <option value="minimal">Minimal</option>
                  <option value="bold">Bold</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="language">Store Language</label>
              <select id="language" name="language" defaultValue={store.language}>
                <option value="en">English</option>
                <option value="ur">Urdu</option>
              </select>
            </div>
            <button type="submit" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
              Save Branding
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">Subscription & Earnings Plan</h2>
          <p className="mt-2 text-sm text-slate-600">
            Current: <span className="font-semibold text-slate-900">{activeSubscription?.planName ?? "None"}</span> ({activeSubscription?.status ?? "inactive"})
          </p>

          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Pay via bank transfer</p>
            <p className="mt-1 text-sm text-slate-700">Transfer the plan amount to this receiving IBAN:</p>
            <p className="mt-2 break-all rounded-lg bg-white px-3 py-2 font-mono text-sm font-bold text-slate-900">{platformReceiverIban}</p>
            <p className="mt-2 text-xs text-slate-600">Account title: {platformAccountTitle}</p>
          </div>

          <div className="mt-4 space-y-4">
            {allPlans.map((plan) => (
              <form key={plan.id} action={submitPlanPaymentRequest} className="rounded-xl border border-slate-200 p-4">
                <input type="hidden" name="storeId" value={store.id} />
                <input type="hidden" name="planId" value={plan.id} />
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{plan.name}</p>
                    <p className="text-sm text-slate-500">{formatCurrency(plan.monthlyPriceCents)}/mo · {plan.productLimit} products</p>
                  </div>
                </div>
                <div className="mt-3 grid gap-3">
                  <input name="transactionReference" placeholder="Bank transaction/reference number" required />
                  <input name="senderName" placeholder="Sender account name (optional)" />
                  <input name="senderIban" placeholder="Sender IBAN (optional)" />
                  <input name="proofUrl" placeholder="Payment proof URL/screenshot link (optional)" />
                </div>
                <button className="mt-3 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700" type="submit">
                  Submit Payment for Verification
                </button>
              </form>
            ))}
          </div>

          <div className="mt-5">
            <p className="text-sm font-semibold text-slate-900">Recent payment requests</p>
            <div className="mt-2 space-y-2">
              {recentPlanPaymentRequests.length === 0 ? (
                <p className="text-xs text-slate-500">No requests submitted yet.</p>
              ) : (
                recentPlanPaymentRequests.map((request) => (
                  <div key={request.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-xs">
                    <div>
                      <p className="font-semibold text-slate-800">{request.planName} · {formatCurrency(request.amountCents)}</p>
                      <p className="text-slate-500">Ref: {request.transactionReference}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold uppercase text-slate-700">{request.status}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">Add Product</h2>
          <form action={addProduct} className="mt-4 space-y-3">
            <input type="hidden" name="storeId" value={store.id} />
            <div>
              <label htmlFor="title">Title</label>
              <input id="title" name="title" required />
            </div>
            <div>
              <label htmlFor="description">Description</label>
              <textarea id="description" name="description" rows={4} required />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label htmlFor="price">Price (USD)</label>
                <input id="price" name="price" type="number" min="0" step="0.01" required />
              </div>
              <div>
                <label htmlFor="inventory">Inventory</label>
                <input id="inventory" name="inventory" type="number" min="0" defaultValue="0" required />
              </div>
            </div>
            <div>
              <label htmlFor="imageUrl">Image URL</label>
              <input id="imageUrl" name="imageUrl" placeholder="https://..." />
            </div>
            <div>
              <label htmlFor="categoryName">Category</label>
              <input id="categoryName" name="categoryName" placeholder="Fashion" />
            </div>
            <div>
              <label htmlFor="tags">Tags (comma separated)</label>
              <input id="tags" name="tags" placeholder="summer,new,limited" />
            </div>
            <button className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500" type="submit">
              Add Product
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">Products & Inventory</h2>
          <div className="mt-4 space-y-3">
            {allProducts.length === 0 ? (
              <p className="text-sm text-slate-600">No products yet.</p>
            ) : (
              allProducts.map((product) => (
                <div key={product.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-900">{product.title}</p>
                      <p className="text-sm text-slate-500">{formatCurrency(product.priceCents)} · Stock: {product.inventory}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/products/${product.id}`} className="text-xs font-semibold text-blue-600 hover:text-blue-500">Edit</Link>
                      <form action={deleteProduct}>
                        <input type="hidden" name="productId" value={product.id} />
                        <button className="text-xs font-semibold text-red-600 hover:text-red-500" type="submit">Delete</button>
                      </form>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">Customers & Orders</h2>
          <form action={addCustomer} className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4">
            <input type="hidden" name="storeId" value={store.id} />
            <p className="text-sm font-semibold text-slate-800">Add Customer</p>
            <input name="fullName" placeholder="Customer name" required />
            <input name="email" type="email" placeholder="customer@email.com" required />
            <button className="rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700" type="submit">
              Add Customer
            </button>
          </form>

          <form action={addOrder} className="mt-4 space-y-3 rounded-xl border border-slate-200 p-4">
            <input type="hidden" name="storeId" value={store.id} />
            <p className="text-sm font-semibold text-slate-800">Create Paid Order</p>
            <select name="customerId" required>
              <option value="">Select customer</option>
              {allCustomers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.fullName}
                </option>
              ))}
            </select>
            <select name="productId" required>
              <option value="">Select product</option>
              {allProducts.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.title}
                </option>
              ))}
            </select>
            <input name="quantity" type="number" min="1" defaultValue="1" required />
            <button className="rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500" type="submit">
              Create Order
            </button>
          </form>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-xl font-bold">Store Blog</h2>
          <form action={addBlogPost} className="mt-4 space-y-3">
            <input type="hidden" name="storeId" value={store.id} />
            <div>
              <label htmlFor="postTitle">Title</label>
              <input id="postTitle" name="title" required />
            </div>
            <div>
              <label htmlFor="excerpt">Excerpt</label>
              <input id="excerpt" name="excerpt" required />
            </div>
            <div>
              <label htmlFor="content">Content</label>
              <textarea id="content" name="content" rows={5} required />
            </div>
            <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700" type="submit">
              Publish Post
            </button>
          </form>

          <div className="mt-5 space-y-3">
            {allBlogPosts.slice(0, 5).map((post) => (
              <Link key={post.id} href={`/s/${store.slug}/blog/${post.slug}`} className="block rounded-xl border border-slate-200 p-3 hover:bg-slate-50">
                <p className="font-semibold text-slate-900">{post.title}</p>
                <p className="text-xs text-slate-500">{formatDate(post.createdAt)}</p>
              </Link>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}
