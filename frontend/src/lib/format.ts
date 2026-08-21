export function formatINR(value: number | string | object | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  let n: number = NaN;
  if (typeof value === "number") {
    n = value;
  } else if (typeof value === "string") {
    n = Number(value);
  } else if (typeof value === "object" && value !== null) {
    if ("toNumber" in value && typeof (value as any).toNumber === "function") {
      n = (value as any).toNumber();
    } else if ("d" in value && Array.isArray((value as any).d)) {
      n = Number((value as any).d[0]);
    } else {
      n = Number(String(value));
    }
  }

  if (Number.isNaN(n) || n === null) return "—";
  const hasDecimals = n % 1 !== 0;
  return "₹" + n.toLocaleString("en-IN", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: hasDecimals ? 2 : 0,
  });
}

export function formatCompact(value: number | string | object | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  let n: number = NaN;
  if (typeof value === "number") n = value;
  else if (typeof value === "string") n = Number(value);
  else if (typeof value === "object" && value !== null) {
    if ("toNumber" in value && typeof (value as any).toNumber === "function") n = (value as any).toNumber();
    else if ("d" in value && Array.isArray((value as any).d)) n = Number((value as any).d[0]);
    else n = Number(String(value));
  }
  if (Number.isNaN(n) || n === null) return "—";
  return "₹" + n.toLocaleString("en-IN", { notation: "compact", maximumFractionDigits: 1 });
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function toDateInput(value: string | Date | null | undefined): string {
  if (!value) return "";
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatPropertyType(type?: string | null): string {
  if (!type) return "Property";
  const t = type.trim().toUpperCase();
  if (t === "HOUSE" || t === "SINGLE_HOUSE") return "Single House";
  if (t === "PG" || t === "PG_HOSTEL") return "PG / Hostel";
  if (t === "VILLA") return "Villa";
  if (t === "MULTI_UNIT_HOUSE") return "Multi-Unit House";
  if (t === "APARTMENT") return "Apartment";
  return type;
}

export function formatBillType(type?: string | null): string {
  if (!type) return "Charge";
  const t = type.trim().toUpperCase();
  if (t === "LATE_FEE") return "Late Fee";
  if (t === "PROPERTY_TAX") return "Property Tax";
  if (t === "RENT") return "Rent";
  if (t === "EB") return "Electricity (EB)";
  if (t === "WATER") return "Water";
  if (t === "MAINTENANCE") return "Maintenance";
  return type.replace(/_/g, " ");
}

export function formatStatusBadge(status?: string | null): { label: string; className: string } {
  if (!status) return { label: "Unknown", className: "bg-slate-100 text-slate-700 border-slate-200" };
  const s = status.trim().toUpperCase();

  // Success / Paid / Active / Available (Green)
  if (["PAID", "SUCCESS", "ACTIVE", "AVAILABLE", "VERIFIED", "COMPLETED", "RESOLVED"].includes(s)) {
    return { label: s.replace(/_/g, " "), className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
  }

  // Informational / Active / Occupied (Blue)
  if (["OCCUPIED", "IN_PROGRESS", "SCHEDULED", "PROCESSING"].includes(s)) {
    return { label: s.replace(/_/g, " "), className: "bg-blue-50 text-blue-700 border-blue-200" };
  }

  // Pending / Due Soon / Partial (Amber)
  if (["PENDING", "PARTIAL", "DUE_SOON", "RESERVED", "UNDER_REVIEW"].includes(s)) {
    return { label: s.replace(/_/g, " "), className: "bg-amber-50 text-amber-700 border-amber-200" };
  }

  // Negative / Overdue / Failed / Blocked / Error (Red)
  if (["OVERDUE", "FAILED", "BLOCKED", "ERROR", "REJECTED", "CANCELLED"].includes(s)) {
    return { label: s.replace(/_/g, " "), className: "bg-rose-50 text-rose-700 border-rose-200" };
  }

  // Neutral / Draft / Inactive / Archived (Slate)
  return { label: s.replace(/_/g, " "), className: "bg-slate-100 text-slate-700 border-slate-200" };
}
