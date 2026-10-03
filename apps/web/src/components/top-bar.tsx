export function TopBar() {
  return (
    <header className="flex h-14 items-center justify-between border-b px-6">
      <div className="flex items-center gap-3">
        <select
          className="rounded-md border bg-background px-3 py-1.5 text-sm"
          defaultValue="default"
        >
          <option value="default">Default Organization</option>
        </select>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          className="rounded-md p-2 hover:bg-muted"
          aria-label="Notifications"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
            <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          </svg>
        </button>
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
            ZA
          </div>
          <span className="text-sm font-medium">Z.AI Developer</span>
        </div>
      </div>
    </header>
  );
}
