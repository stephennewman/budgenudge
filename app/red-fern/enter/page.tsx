import type { Metadata } from "next";
import RedFernLogo from "../logo";
import { VENUE } from "@/utils/red-fern/catalog";
import { DEMO_SITE_CODE, isDemoSiteCode } from "@/utils/red-fern/server/access";

/**
 * The front door.
 *
 * Everything under /red-fern is private until a visitor has the house code, so
 * this is the one page in the section a stranger can reach. It's a plain form
 * post rather than a client component: the code goes straight to the server
 * and never touches the browser's JavaScript.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Red Fern Plantation",
  robots: { index: false, follow: false, nocache: true },
};

export default async function EnterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; wrong?: string }>;
}) {
  const params = await searchParams;
  const wrong = params.wrong === "1";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#3c4143] px-4 py-16 text-[#f4f2ef]">
      <form
        method="post"
        action="/api/red-fern/access"
        className="w-full max-w-sm rounded-2xl bg-[#4d5355] p-6 ring-1 ring-[#5b6264]"
      >
        <RedFernLogo tone="light" size="sm" align="start" />
        <h1 className="mt-5 rf-display text-2xl">By invitation</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#d6d3ce]">
          {VENUE.name} isn&apos;t open to the public web yet. Enter the house code to see the
          booking pages.
        </p>

        <input type="hidden" name="next" value={params.next ?? "/red-fern"} />
        <label htmlFor="code" className="sr-only">
          House code
        </label>
        <input
          id="code"
          name="code"
          type="password"
          autoComplete="current-password"
          autoFocus
          placeholder="House code"
          className="mt-5 h-11 w-full rounded-xl bg-[#3c4143] px-4 text-sm text-[#f4f2ef] ring-1 ring-[#5b6264] focus:outline-none focus:ring-2 focus:ring-[#cf8577]"
        />
        {wrong && (
          <p className="mt-3 text-sm text-[#e5b0a6]">That isn&apos;t the code. Try again.</p>
        )}
        <button
          type="submit"
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-[#8e2b1e] px-4 text-sm font-semibold text-[#f4f2ef] transition hover:brightness-110"
        >
          Come in
        </button>
        {isDemoSiteCode() && (
          <p className="mt-4 text-xs leading-relaxed text-[#a8adaf]">
            Demo: the code is <span className="rf-wordmark text-[#cf8577]">{DEMO_SITE_CODE}</span>.
            Set <span className="font-mono">RED_FERN_SITE_CODE</span> to change it.
          </p>
        )}
      </form>
    </main>
  );
}
