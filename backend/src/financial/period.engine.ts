import { PeriodFilter, ParsedPeriod } from "./types";

export function parsePeriodDates(filter: PeriodFilter = {}): ParsedPeriod {
  const now = new Date();
  let billingMonth = filter.billingMonth;
  let fromDate: Date;
  let toDate: Date;

  if (billingMonth && /^\d{4}-\d{2}$/.test(billingMonth)) {
    const [y, m] = billingMonth.split("-").map(Number);
    fromDate = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
    toDate = new Date(Date.UTC(y, m, 0, 23, 59, 59, 999));
  } else if (filter.from || filter.to) {
    fromDate = filter.from ?? new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
    toDate = filter.to ?? new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
    billingMonth = `${fromDate.getUTCFullYear()}-${String(fromDate.getUTCMonth() + 1).padStart(2, "0")}`;
  } else {
    billingMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    fromDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0));
    toDate = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999));
  }

  return { billingMonth, fromDate, toDate };
}
