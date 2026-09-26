import { desc, eq, sql } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { orders, planPaymentRequests, plans, storeSubscriptions, stores, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/login");
  if (currentUser.role !== "admin") redirect("/dashboard");
  const adminUserId = currentUser.id;

  const [
    storeRows,
    plansList,
    totalSalesResult,
    activeStoresResult,
    totalUsersResult,
    planRevenueResult,
    paymentRequests,
  ] = await Promise.all([
    db
      .select({
        storeId: stores.id,
        storeName: stores.name,
        storeSlug: stores.slug,
        status: stores.status,
        ownerEmail: users.email,
        ownerName: users.fullName,
      })
      .from(stores)
      .innerJoin(users, eq(users.id, stores.ownerUserId))
      .orderBy(desc(stores.createdAt)),
    db.select().from(plans),
    db
      .select({ totalSales: sql<number>`coalesce(sum(${orders.totalCents}), 0)::int` })
      .from(orders)
      .where(sql`${orders.status} in ('paid', 'fulfilled')`),
    db
      .select({ activeStores: sql<number>`count(*)::int` })
      .from(stores)
      .where(eq(stores.status, "active")),
    db.select({ totalUsers: sql<number>`count(*)::int` }).from(users),
    db
      .select({
        totalRevenue: sql<number>`coalesce(sum(${plans.monthlyPriceCents}), 0)::int`,
      })
      .from(storeSubscriptions)
      .innerJoin(plans, eq(plans.id, storeSubscriptions.planId))
      .where(eq(storeSubscriptions.status, "active")),
    db
      .select({
        id: planPaymentRequests.id,
        storeId: planPaymentRequests.storeId,
        planId: planPaymentRequests.planId,
        receiverIban: planPaymentRequests.receiverIban,
        amountCents: planPaymentRequests.amountCents,
        senderName: planPaymentRequests.senderName,
        senderIban: planPaymentRequests.senderIban,
        transactionReference: planPaymentRequests.transactionReference,
        proofUrl: planPaymentRequests.proofUrl,
        status: planPaymentRequests.status,
        createdAt: planPaymentRequests.createdAt,
        storeName: stores.name,
        planName: plans.name,
      })
      .from(planPaymentRequests)
      .innerJoin(stores, eq(stores.id, planPaymentRequests.storeId))
      .innerJoin(plans, eq(plans.id, planPaymentRequests.planId))
      .orderBy(desc(planPaymentRequests.createdAt))
      .limit(30),
  ]);

  async function setStoreStatus(formData: FormData) {
    "use server";
    const storeId = String(formData.get("storeId") ?? "");
    const status = String(formData.get("status") ?? "active");
    if (!storeId || (status !== "active" && status !== "suspended")) {
      redirect("/admin?error=status");
    }

    await db.update(stores).set({ status }).where(eq(stores.id, storeId));
    redirect("/admin?saved=status");
  }

  async function upgradeStorePlan(formData: FormData) {
    "use server";
    const storeId = String(formData.get("storeId") ?? "");
    const planId = Number(formData.get("planId") ?? 0);

    if (!storeId || !planId) {
      redirect("/admin?error=plan");
    }

    await db.insert(storeSubscriptions).values({
      storeId,
      planId,
      status: "active",
      paymentProvider: "admin",
      paymentReference: `ADMIN-${Date.now()}`,
      renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    redirect("/admin?saved=plan");
  }

  async function reviewPlanPaymentRequest(formData: FormData) {
    "use server";

    const requestId = String(formData.get("requestId") ?? "");
    const action = String(formData.get("action") ?? "");
    const adminNotes = String(formData.get("adminNotes") ?? "").trim();

    if (!requestId || (action !== "approve" && action !== "reject")) {
      redirect("/admin?error=review");
    }

    const [request] = await db.select().from(planPaymentRequests).where(eq(planPaymentRequests.id, requestId)).limit(1);
    if (!request) {
      redirect("/admin?error=request-not-found");
    }

    if (action === "approve") {
      await db.insert(storeSubscriptions).values({
        storeId: request.storeId,
        planId: request.planId,
        status: "active",
        paymentProvider: "bank_transfer",
        paymentReference: request.transactionReference,
        renewsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });

      await db
        .update(planPaymentRequests)
        .set({
          status: "approved",
          adminNotes: adminNotes || "Payment received in bank account.",
          reviewedByAdminId: adminUserId,
          reviewedAt: new Date(),
        })
        .where(eq(planPaymentRequests.id, requestId));
    } else {
      await db
        .update(planPaymentRequests)
        .set({
          status: "rejected",
          adminNotes: adminNotes || "Transfer not matched in bank statement.",
          reviewedByAdminId: adminUserId,
          reviewedAt: new Date(),
        })
        .where(eq(planPaymentRequests.id, requestId));
    }

    redirect("/admin?saved=review");
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">Super Admin</p>
          <h1 className="text-3xl font-black text-slate-950">Platform Control Center</h1>
        </div>
        <Link href="/logout" className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
          Logout
        </Link>
      </header>

      <section className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Total Sales</p>
          <p className="mt-2 text-3xl font-black">{formatCurrency(totalSalesResult[0]?.totalSales ?? 0)}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Active Stores</p>
          <p className="mt-2 text-3xl font-black">{activeStoresResult[0]?.activeStores ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Users</p>
          <p className="mt-2 text-3xl font-black">{totalUsersResult[0]?.totalUsers ?? 0}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Plan Revenue (MRR)</p>
          <p className="mt-2 text-3xl font-black">{formatCurrency(planRevenueResult[0]?.totalRevenue ?? 0)}</p>
        </article>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-950">Bank Transfer Payment Requests</h2>
        <p className="mt-1 text-sm text-slate-600">Review payments sent to receiver IBAN and approve to activate plan.</p>
        <div className="mt-4 space-y-3">
          {paymentRequests.length === 0 ? (
            <p className="text-sm text-slate-600">No payment requests yet.</p>
          ) : (
            paymentRequests.map((request) => (
              <div key={request.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{request.storeName} → {request.planName}</p>
                    <p className="text-xs text-slate-500">{formatDate(request.createdAt)} · {formatCurrency(request.amountCents)}</p>
                    <p className="mt-1 text-xs text-slate-600">Receiver IBAN: {request.receiverIban}</p>
                    <p className="text-xs text-slate-600">Txn Ref: {request.transactionReference}</p>
                    {request.senderName && <p className="text-xs text-slate-600">Sender: {request.senderName}</p>}
                    {request.senderIban && <p className="text-xs text-slate-600">Sender IBAN: {request.senderIban}</p>}
                    {request.proofUrl && (
                      <a href={request.proofUrl} target="_blank" rel="noreferrer" className="text-xs font-semibold text-blue-600 hover:text-blue-500">
                        Open payment proof
                      </a>
                    )}
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase text-slate-700">{request.status}</span>
                </div>

                {request.status === "pending" && (
                  <form action={reviewPlanPaymentRequest} className="mt-3 flex flex-wrap items-center gap-2">
                    <input type="hidden" name="requestId" value={request.id} />
                    <input name="adminNotes" placeholder="Admin notes (optional)" className="max-w-xs" />
                    <button type="submit" name="action" value="approve" className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-500">
                      Approve & Activate
                    </button>
                    <button type="submit" name="action" value="reject" className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500">
                      Reject
                    </button>
                  </form>
                )}
              </div>
            ))
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-xl font-bold text-slate-950">Stores Management</h2>
        <div className="mt-4 space-y-3">
          {storeRows.map((store) => (
            <div key={store.storeId} className="rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{store.storeName}</p>
                  <p className="text-sm text-slate-500">{store.ownerName} · {store.ownerEmail}</p>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{store.status}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Link className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700" href={`/s/${store.storeSlug}`}>
                    View
                  </Link>
                  <form action={setStoreStatus}>
                    <input type="hidden" name="storeId" value={store.storeId} />
                    <input type="hidden" name="status" value={store.status === "active" ? "suspended" : "active"} />
                    <button className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white" type="submit">
                      {store.status === "active" ? "Suspend" : "Activate"}
                    </button>
                  </form>
                  <form action={upgradeStorePlan} className="flex items-center gap-2">
                    <input type="hidden" name="storeId" value={store.storeId} />
                    <select name="planId" required className="w-36">
                      <option value="">Upgrade plan</option>
                      {plansList.map((plan) => (
                        <option key={plan.id} value={plan.id}>{plan.name}</option>
                      ))}
                    </select>
                    <button className="rounded-full bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white" type="submit">
                      Apply
                    </button>
                  </form>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
