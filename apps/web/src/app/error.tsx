"use client";

import { useEffect } from "react";

export default function GlobalRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ui] route error", error);
  }, [error]);

  return (
    <main className="grid min-h-[70vh] place-items-center p-6">
      <section className="w-full max-w-lg rounded-3xl border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-muted text-lg">!</div>
        <h1 className="mt-5 text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This page could not finish loading. Your data was not intentionally changed.
          Try again, and if the problem continues, use the activity or audit page to investigate.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 h-10 rounded-xl bg-foreground px-4 text-sm font-semibold text-background"
        >
          Try again
        </button>
      </section>
    </main>
  );
}
