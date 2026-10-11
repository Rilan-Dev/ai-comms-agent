"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

type NotificationKind = "success" | "error" | "info" | "warning";

type Notification = {
  id: string;
  kind: NotificationKind;
  title: string;
  message?: string;
};

type NotificationContextValue = {
  notify: (input: Omit<Notification, "id">) => void;
  dismiss: (id: string) => void;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Notification[]>([]);

  const dismiss = useCallback((id: string) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((input: Omit<Notification, "id">) => {
    const id = globalThis.crypto?.randomUUID?.() ?? String(Date.now());
    setItems((current) => [...current, { ...input, id }]);
    window.setTimeout(() => dismiss(id), input.kind === "error" ? 7000 : 4500);
  }, [dismiss]);

  const value = useMemo(() => ({ notify, dismiss }), [notify, dismiss]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex max-w-md flex-col gap-2 sm:left-auto sm:right-4 sm:w-[380px]" aria-live="polite" aria-atomic="false">
        {items.map((item) => (
          <div
            key={item.id}
            role={item.kind === "error" ? "alert" : "status"}
            className="pointer-events-auto rounded-2xl border bg-background p-4 shadow-xl"
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{item.title}</p>
                {item.message ? <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.message}</p> : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                className="rounded-lg px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Dismiss notification"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
}
