import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { text, type Lang } from "@/lib/i18n";

type Props = {
  lang: Lang;
};

export async function SiteHeader({ lang }: Props) {
  const t = text[lang];
  const user = await getCurrentUser();
  const query = `?lang=${lang}`;

  return (
    <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <Link href={`/${query}`} className="text-lg font-bold tracking-tight text-slate-950">
          StoreForge
        </Link>

        <nav className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100" href={`/${query}`}>
            {t.navHome}
          </Link>
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100" href={`/pricing${query}`}>
            {t.navPricing}
          </Link>
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100" href={`/stores${query}`}>
            {t.navStores}
          </Link>
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100" href={`/contact${query}`}>
            {t.navContact}
          </Link>
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={lang === "en" ? "/?lang=ur" : "/?lang=en"}
            className="rounded-full border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            {lang === "en" ? "اردو" : "English"}
          </Link>
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Dashboard
              </Link>
              <Link
                href="/logout"
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Logout
              </Link>
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                Login
              </Link>
              <Link
                href="/god-login"
                className="rounded-full border border-blue-300 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50"
              >
                God Login
              </Link>
              <Link
                href="/signup"
                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
              >
                {t.ctaTrial}
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
