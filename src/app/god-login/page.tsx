import { redirect } from "next/navigation";
import { GodLoginForm } from "@/components/god-login-form";
import { getCurrentUser } from "@/lib/auth";

export default async function GodLoginPage() {

  const currentUser = await getCurrentUser();
  if (currentUser?.role === "admin") {
    redirect("/god");
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-10">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-blue-600">Admin testing access</p>
        <h1 className="mt-2 text-2xl font-black text-slate-950">God Login</h1>
        <p className="mt-1 text-sm text-slate-600">Secure in-app login flow. No external redirects.</p>
        <GodLoginForm />
      </section>
    </main>
  );
}
