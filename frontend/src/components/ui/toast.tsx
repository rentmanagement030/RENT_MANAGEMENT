import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastType = "success" | "error" | "info";

interface Toast {
  id: number;
  title: string;
  description?: string;
  type: ToastType;
}

interface ToastContextValue {
  toast: (title: string, opts?: { description?: string; type?: ToastType }) => void;
  success: (title: string, description?: string) => void;
  error: (title: string, description?: string) => void;
  info: (title: string, description?: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (title: string, opts?: { description?: string; type?: ToastType }) => {
      const id = nextId++;
      setToasts((prev) => [...prev.slice(-4), { id, title, description: opts?.description, type: opts?.type ?? "success" }]);
      setTimeout(() => dismiss(id), 5000);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      toast: push,
      success: (t, d) => push(t, { description: d, type: "success" }),
      error: (t, d) => push(t, { description: d, type: "error" }),
      info: (t, d) => push(t, { description: d, type: "info" }),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((t) => (
          <ToastPrimitive.Root
            key={t.id}
            className={cn(
              "pointer-events-auto relative flex w-full items-start gap-3 rounded-lg border bg-background p-4 shadow-lg",
            )}
            onOpenChange={(open) => {
              if (!open) dismiss(t.id);
            }}
          >
            {t.type === "success" && <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-emerald-600" />}
            {t.type === "error" && <AlertCircle className="mt-0.5 size-5 shrink-0 text-red-600" />}
            {t.type === "info" && <Info className="mt-0.5 size-5 shrink-0 text-sky-600" />}
            <div className="flex-1 space-y-1">
              <ToastPrimitive.Title className="text-sm font-medium">{t.title}</ToastPrimitive.Title>
              {t.description && <ToastPrimitive.Description className="text-xs text-muted-foreground">{t.description}</ToastPrimitive.Description>}
            </div>
            <ToastPrimitive.Close className="shrink-0 rounded-md p-1 opacity-60 hover:opacity-100">
              <X className="size-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex max-h-screen w-full max-w-sm flex-col gap-2 p-4 outline-none" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
