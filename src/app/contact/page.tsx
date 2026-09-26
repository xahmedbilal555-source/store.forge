import { redirect } from "next/navigation";
import { db } from "@/db";
import { supportMessages } from "@/db/schema";
import { PageShell } from "@/components/page-shell";
import { SiteHeader } from "@/components/site-header";
import { getLang } from "@/lib/i18n";

export default async function ContactPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const lang = getLang(typeof resolvedSearchParams.lang === "string" ? resolvedSearchParams.lang : undefined);
  const success = resolvedSearchParams.success === "1";

  async function submitContact(formData: FormData) {
    "use server";

    const name = String(formData.get("name") ?? "").trim();
    const email = String(formData.get("email") ?? "").trim();
    const message = String(formData.get("message") ?? "").trim();

    if (!name || !email || !message) {
      redirect("/contact?error=missing");
    }

    await db.insert(supportMessages).values({ name, email, message });
    redirect("/contact?success=1");
  }

  return (
    <div>
      <SiteHeader lang={lang} />
      <PageShell>
        <h1 className="text-3xl font-black text-slate-950">Contact Support</h1>
        <p className="mt-2 text-slate-600">We usually reply within one business day.</p>

        <div className="mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
          {success && <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm font-medium text-green-700">Thanks! Your message has been received.</p>}
          <form action={submitContact} className="space-y-4">
            <div>
              <label htmlFor="name">Name</label>
              <input id="name" name="name" required />
            </div>
            <div>
              <label htmlFor="email">Email</label>
              <input id="email" name="email" type="email" required />
            </div>
            <div>
              <label htmlFor="message">Message</label>
              <textarea id="message" name="message" rows={5} required />
            </div>
            <button className="rounded-full bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-500" type="submit">
              Send Message
            </button>
          </form>
        </div>
      </PageShell>
    </div>
  );
}
