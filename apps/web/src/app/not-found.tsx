import Link from "next/link";

export default function NotFound() {
  return (
    <main className="grid min-h-[70vh] place-items-center p-6">
      <section className="w-full max-w-lg rounded-3xl border bg-background p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[.16em] text-muted-foreground">404</p>
        <h1 className="mt-3 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">The destination does not exist or is no longer available.</p>
        <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-xl bg-foreground px-4 text-sm font-semibold text-background">
          Back to dashboard
        </Link>
      </section>
    </main>
  );
}
