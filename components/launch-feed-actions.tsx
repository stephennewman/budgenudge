"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * Copy-to-clipboard for the feed URL. Google Calendar has no one-tap
 * subscribe, so pasting the URL into "Add calendar > From URL" is the path
 * there, and the URL can carry a token that shouldn't be retyped by hand.
 */
export default function LaunchFeedActions({ feedUrl }: { feedUrl: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(feedUrl);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-col gap-2">
      <code className="block overflow-x-auto rounded-lg bg-slate-900 px-3 py-3 text-xs text-slate-300 ring-1 ring-slate-700">
        {feedUrl}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-slate-800 px-4 text-sm font-medium text-slate-100 ring-1 ring-slate-700 transition hover:bg-slate-700"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? "Copied" : "Copy feed URL"}
      </button>
    </div>
  );
}
