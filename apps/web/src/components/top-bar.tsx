"use client";

export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b bg-background/80 px-4 backdrop-blur sm:px-6 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <button className="grid h-9 w-9 place-items-center rounded-lg border text-sm text-muted-foreground md:hidden" aria-label="Open navigation">☰</button>
        <div className="hidden sm:block"><p className="text-sm font-semibold">Default Organization</p><p className="text-[11px] text-muted-foreground">Communications workspace</p></div>
      </div>
      <div className="flex items-center gap-2 sm:gap-4">
        <button className="grid h-9 w-9 place-items-center rounded-lg border text-sm text-muted-foreground transition hover:bg-muted" aria-label="Search">⌕</button>
        <button className="relative grid h-9 w-9 place-items-center rounded-lg border text-sm text-muted-foreground transition hover:bg-muted" aria-label="Notifications">♢<span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500"/></button>
        <div className="h-6 w-px bg-border"/>
        <div className="flex items-center gap-2.5"><div className="grid h-9 w-9 place-items-center rounded-full bg-muted text-xs font-semibold">MR</div><div className="hidden text-right sm:block"><p className="text-xs font-semibold">Rilan</p><p className="text-[10px] text-muted-foreground">Owner</p></div></div>
      </div>
    </header>
  );
}
