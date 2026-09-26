import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { getCurrentUserStore } from "@/lib/auth";
import { planPaymentRequests, plans } from "@/db/schema";

const RECEIVER_IBAN = "PK35SADA0000003335265823";
const RECEIVER_ACCOUNT_TITLE = "StoreForge Platform Billing";

export async function POST(request: Request) {
  const { user, store } = await getCurrentUserStore();
  if (!user || !store) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as
    | {
        planCode?: string;
        transactionReference?: string;
        senderName?: string;
        senderIban?: string;
        proofUrl?: string;
      }
    | null;

  const planCode = body?.planCode;
  const transactionReference = body?.transactionReference?.trim();

  if (!planCode || !transactionReference) {
    return NextResponse.json({ error: "Missing planCode or transactionReference" }, { status: 400 });
  }

  const [plan] = await db.select().from(plans).where(eq(plans.code, planCode)).limit(1);
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const [paymentRequest] = await db
    .insert(planPaymentRequests)
    .values({
      storeId: store.id,
      planId: plan.id,
      receiverIban: RECEIVER_IBAN,
      accountTitle: RECEIVER_ACCOUNT_TITLE,
      amountCents: plan.monthlyPriceCents,
      senderName: body?.senderName?.trim() || null,
      senderIban: body?.senderIban?.trim() || null,
      transactionReference,
      proofUrl: body?.proofUrl?.trim() || null,
      status: "pending",
    })
    .returning();

  return NextResponse.json({
    ok: true,
    message: "Payment request submitted. Admin will verify and activate the plan.",
    receiverIban: RECEIVER_IBAN,
    accountTitle: RECEIVER_ACCOUNT_TITLE,
    paymentRequest,
  });
}
