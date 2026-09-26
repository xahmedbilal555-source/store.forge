import Link from "next/link";
import { redirect } from "next/navigation";
import { eq, or } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { setSession, verifyPassword } from "@/lib/auth";
import { ensurePlatformBootstrap } from "@/lib/bootstrap";
import { GOD_USERNAME } from "@/lib/god-account";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedSearchParams = await searchParams;
  const error = typeof resolvedSearchParams.error === "string" ? resolvedSearchParams.error : "";

  async function loginAction(formData: FormData) {
    "use server";

    await ensurePlatformBootstrap();

    const identifier = String(formData.get("identifier") ?? "").trim();
    const password = String(formData.get("password") ?? "");

    const [user] = await db
      .select()
      .from(users)
      .where(or(eq(users.email, identifier.toLowerCase()), eq(users.username, identifier)))
      .limit(1);

    if (!user || !verifyPassword(password, user.passwordHash)) {
      redirect("/login?error=1");
    }

    await setSession(user.id);

    if (user.username === GOD_USERNAME) {
      redirect("/god");
    }

    redirect(user.role === "admin" ? "/admin" : "/dashboard");
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-md place-items-center px-4 py-10">
      <section className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
        <h1 className="text-2xl font-black text-slate-950">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">Manage your store and sales.</p>
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">Invalid username/email or password.</p>}
        <form action={loginAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="identifier">Email or Username</label>
            <input id="identifier" name="identifier" required />
          </div>
          <div>
            <label htmlFor="password">Password</label>
            <input id="password" name="password" type="password" required />
          </div>
          <button className="w-full rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700" type="submit">
            Login
          </button>
        </form>

        <button className="mt-3 w-full rounded-full border border-slate-300 px-5 py-2.5 text-sm font-semibold text-slate-500" type="button">
          Continue with Google (optional)
        </button>

        <div className="mt-4 text-center text-sm text-slate-600">
          New here? <Link className="font-semibold text-blue-600" href="/signup">Create account</Link>
        </div>
        <div className="mt-2 text-center text-sm text-slate-600">
          Need full test access? <Link className="font-semibold text-blue-600" href="/god-login">Use God Login</Link>
        </div>
      </section>
    </main>
  );
}
