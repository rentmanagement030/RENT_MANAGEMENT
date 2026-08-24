import React, { forwardRef, useState, useRef, useEffect, useMemo, Children, isValidElement } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown, Loader2, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------- Button ----------
const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-bold transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 touch-manipulation min-h-[44px]",
  {
    variants: {
      variant: {
        default: "bg-blue-600 text-white shadow-md shadow-blue-600/20 hover:bg-blue-700",
        destructive: "bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100",
        outline: "border border-slate-200 bg-white text-slate-800 shadow-2xs hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300",
        secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200/80",
        ghost: "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
        link: "text-blue-600 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2.5",
        sm: "h-9 rounded-lg px-3 text-xs min-h-[36px]",
        lg: "h-12 rounded-2xl px-6 text-base",
        icon: "size-11 rounded-xl p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      ref={ref}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="animate-spin" />}
      {children}
    </button>
  ),
);
Button.displayName = "Button";

// ---------- Input ----------
export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      className={cn(
        "flex h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-colors focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] shadow-2xs",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Input.displayName = "Input";

// ---------- Textarea ----------
export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      className={cn(
        "flex min-h-[90px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-900 placeholder:text-slate-400 transition-colors focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation shadow-2xs",
        className,
      )}
      ref={ref}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

// ---------- Label ----------
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-xs font-extrabold uppercase tracking-wider text-slate-600 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70", className)}
      {...props}
    />
  );
}

// ---------- Select (Custom SaaS UI with search, icons & popover) ----------
interface ParsedOption {
  value: string;
  label: string;
  disabled?: boolean;
}

function parseSelectChildren(children: React.ReactNode): ParsedOption[] {
  const options: ParsedOption[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      const childProps = child.props as any;
      if (child.type === "option") {
        options.push({
          value: String(childProps.value ?? ""),
          label: String(childProps.children ?? childProps.value ?? ""),
          disabled: Boolean(childProps.disabled),
        });
      } else if (child.type === "optgroup" && childProps.children) {
        Children.forEach(childProps.children, (sub) => {
          if (isValidElement(sub) && sub.type === "option") {
            const subProps = sub.props as any;
            options.push({
              value: String(subProps.value ?? ""),
              label: String(subProps.children ?? subProps.value ?? ""),
              disabled: Boolean(subProps.disabled),
            });
          }
        });
      }
    }
  });
  return options;
}

export function Select({
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  placeholder,
  name,
  id,
  required,
  ...props
}: {
  icon?: any;
  placeholder?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => parseSelectChildren(children), [children]);

  const currentValue = value !== undefined ? String(value) : (defaultValue !== undefined ? String(defaultValue) : (options[0]?.value ?? ""));
  const selectedOption = options.find((o) => o.value === currentValue) || options[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (val: string) => {
    setIsOpen(false);
    setQuery("");
    if (onChange) {
      const syntheticEvent = {
        target: { value: val, name: name || id },
        currentTarget: { value: val, name: name || id },
        bubbles: true,
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <select
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        id={id}
        required={required}
        value={currentValue}
        onChange={onChange}
        disabled={disabled}
      >
        {children}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-bold text-slate-900 transition-all hover:border-slate-300 focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] shadow-2xs text-left cursor-pointer",
          isOpen && "border-blue-600 ring-2 ring-blue-600/20",
          className
        )}
      >
        <span className={cn("truncate min-w-0 flex-1", !selectedOption && "text-slate-400 font-medium")}>
          {selectedOption?.label || placeholder || "Select..."}
        </span>
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2", isOpen && "rotate-180 text-blue-600")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl max-h-64 overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-150">
          {options.length > 5 && (
            <div className="p-1 mb-1 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search options..."
                  className="w-full h-8 pl-8 pr-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto space-y-0.5 max-h-56 pr-0.5">
            {filteredOptions.length === 0 ? (
              <p className="p-3 text-center text-slate-400 font-medium italic">No matching options</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === currentValue;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer text-xs",
                      opt.disabled && "opacity-40 cursor-not-allowed",
                      isSelected
                        ? "bg-blue-50 text-blue-900 font-extrabold"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                    )}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    {isSelected && <Check className="size-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- FilterSelect (Professional SaaS Filter Control with custom UI) ----------
export function FilterSelect({
  icon: Icon,
  className,
  children,
  value,
  defaultValue,
  onChange,
  disabled,
  placeholder,
  name,
  id,
  required,
  ...props
}: {
  icon?: any;
  placeholder?: string;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const options = useMemo(() => parseSelectChildren(children), [children]);

  const currentValue = value !== undefined ? String(value) : (defaultValue !== undefined ? String(defaultValue) : (options[0]?.value ?? ""));
  const selectedOption = options.find((o) => o.value === currentValue) || options[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q));
  }, [options, query]);

  const handleSelect = (val: string) => {
    setIsOpen(false);
    setQuery("");
    if (onChange) {
      const syntheticEvent = {
        target: { value: val, name: name || id },
        currentTarget: { value: val, name: name || id },
        bubbles: true,
      } as unknown as React.ChangeEvent<HTMLSelectElement>;
      onChange(syntheticEvent);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <select
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        id={id}
        required={required}
        value={currentValue}
        onChange={onChange}
        disabled={disabled}
      >
        {children}
      </select>

      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        className={cn(
          "flex h-11 w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50/70 py-2.5 text-xs sm:text-sm font-extrabold text-slate-800 transition-all hover:bg-white hover:border-slate-300 focus-visible:border-blue-600 focus-visible:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation min-h-[44px] shadow-2xs cursor-pointer text-left",
          Icon ? "pl-10 pr-3.5" : "pl-3.5 pr-3.5",
          isOpen && "bg-white border-blue-600 ring-2 ring-blue-600/20",
          className
        )}
      >
        {Icon && (
          <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400 pointer-events-none z-10" />
        )}
        <span className="truncate min-w-0 flex-1">
          {selectedOption?.label || placeholder || "All"}
        </span>
        <ChevronDown className={cn("size-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2", isOpen && "rotate-180 text-blue-600")} />
      </button>

      {isOpen && (
        <div className="absolute left-0 top-full mt-1.5 z-50 min-w-full w-max max-w-sm sm:max-w-md rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl max-h-64 overflow-hidden flex flex-col text-xs animate-in fade-in zoom-in-95 duration-150">
          {options.length > 5 && (
            <div className="p-1 mb-1 border-b border-slate-100 shrink-0">
              <div className="relative">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Filter options..."
                  className="w-full h-8 pl-8 pr-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          <div className="overflow-y-auto space-y-0.5 max-h-56 pr-0.5">
            {filteredOptions.length === 0 ? (
              <p className="p-3 text-center text-slate-400 font-medium italic">No matching items</p>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === currentValue;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => handleSelect(opt.value)}
                    className={cn(
                      "flex w-full items-center justify-between px-3 py-2 rounded-xl text-left transition-all cursor-pointer text-xs",
                      opt.disabled && "opacity-40 cursor-not-allowed",
                      isSelected
                        ? "bg-blue-50 text-blue-900 font-extrabold"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-900 font-semibold"
                    )}
                  >
                    <span className="truncate pr-2">{opt.label}</span>
                    {isSelected && <Check className="size-3.5 text-blue-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Card ----------
export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("rounded-2xl border border-slate-200/90 bg-white text-slate-900 shadow-sm shadow-slate-200/50 transition-all hover:border-slate-300", className)} {...props} />
  ),
);
Card.displayName = "Card";

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col space-y-1.5 p-5 sm:p-6", className)} {...props} />
  ),
);
CardHeader.displayName = "CardHeader";

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn("text-lg font-extrabold tracking-tight text-slate-900", className)} {...props} />
  ),
);
CardTitle.displayName = "CardTitle";

export const CardDescription = forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xs font-medium text-slate-500", className)} {...props} />
  ),
);
CardDescription.displayName = "CardDescription";

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn("p-5 sm:p-6 pt-0", className)} {...props} />,
);
CardContent.displayName = "CardContent";

export const CardFooter = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center p-5 sm:p-6 pt-0", className)} {...props} />
  ),
);
CardFooter.displayName = "CardFooter";

// ---------- Badge ----------
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-extrabold transition-colors",
  {
    variants: {
      variant: {
        default: "border-blue-200 bg-blue-50 text-blue-700",
        secondary: "border-slate-200 bg-slate-100 text-slate-700",
        outline: "border-slate-300 text-slate-700",
        success: "border-emerald-200 bg-emerald-50 text-emerald-700",
        warning: "border-amber-200 bg-amber-50 text-amber-700",
        destructive: "border-rose-200 bg-rose-50 text-rose-700",
        info: "border-sky-200 bg-sky-50 text-sky-700",
        muted: "border-slate-200 bg-slate-100 text-slate-500",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// ---------- Table ----------
export function Table({ className, ...props }: React.TableHTMLAttributes<HTMLTableElement>) {
  return (
    <div className="relative w-full overflow-x-auto scrollbar-none">
      <table className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  );
}

export function TableHeader({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn("[&_tr]:border-b border-slate-200 bg-slate-50/80", className)} {...props} />;
}

export function TableBody({ className, ...props }: React.HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn("[&_tr:last-child]:border-0 divide-y divide-slate-100", className)} {...props} />;
}

export function TableRow({ className, ...props }: React.HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={cn("border-b border-slate-100 transition-colors hover:bg-slate-50/80", className)} {...props} />
  );
}

export function TableHead({ className, ...props }: React.ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={cn("h-11 px-4 text-left align-middle font-extrabold text-xs uppercase tracking-wider text-slate-500", className)} {...props} />
  );
}

export function TableCell({ className, ...props }: React.TdHTMLAttributes<HTMLTableCellElement>) {
  return <td className={cn("p-4 align-middle text-slate-800 font-medium", className)} {...props} />;
}

// ---------- Spinner / Skeleton ----------
export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-5 animate-spin text-blue-600", className)} />;
}

export function PageLoader({ label }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-24 text-slate-500">
      <Loader2 className="size-8 animate-spin text-blue-600" />
      <p className="text-sm font-semibold">{label ?? "Loading…"}</p>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-slate-200/80", className)} />;
}

// ---------- Checkbox ----------
export function Checkbox({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "size-5 rounded-md border-slate-300 bg-white text-blue-600 accent-blue-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-600",
        className,
      )}
      {...props}
    />
  );
}

