/**
 * Utility functions for calendar-aware tax due date arithmetic,
 * period advancement, and dynamic reminder calculations.
 */

export function addMonthsSafely(date: Date, months: number): Date {
  const d = new Date(date);
  const targetMonth = d.getMonth() + months;
  const originalDay = d.getDate();

  d.setMonth(targetMonth);
  // Handle month-end bounds (e.g. Jan 31 + 1 month -> Feb 28/29)
  if (d.getDate() !== originalDay) {
    d.setDate(0); // Set to last day of intended month
  }
  return d;
}

export function addYearsSafely(date: Date, years: number): Date {
  const d = new Date(date);
  const targetYear = d.getFullYear() + years;
  const originalDay = d.getDate();

  d.setFullYear(targetYear);
  if (d.getDate() !== originalDay) {
    d.setDate(0);
  }
  return d;
}

/**
 * Calculates the next due date based on frequency.
 */
export function calculateNextDueDate(fromDate: Date, frequency: string): Date {
  const freq = (frequency || "ANNUAL").toUpperCase();
  const d = new Date(fromDate);

  switch (freq) {
    case "ANNUAL":
      return addYearsSafely(d, 1);
    case "HALF_YEARLY":
      return addMonthsSafely(d, 6);
    case "QUARTERLY":
      return addMonthsSafely(d, 3);
    case "BI_MONTHLY":
      return addMonthsSafely(d, 2);
    case "MONTHLY":
      return addMonthsSafely(d, 1);
    default:
      return addYearsSafely(d, 1);
  }
}

/**
 * Advances the tax period string (e.g., "2026-27" -> "2027-28", "2026-Q2" -> "2026-Q3").
 */
export function calculateNextTaxPeriod(currentPeriod: string, frequency: string): string {
  if (!currentPeriod) {
    const yr = new Date().getFullYear();
    return `${yr}-${(yr + 1).toString().slice(-2)}`;
  }

  const period = currentPeriod.trim();

  // Pattern YYYY-YY (e.g. 2026-27 or 2026-2027)
  const fiscalMatch = period.match(/^(\d{4})-(\d{2,4})$/);
  if (fiscalMatch) {
    const startYr = parseInt(fiscalMatch[1], 10) + 1;
    const endYr = parseInt(fiscalMatch[2], 10) + 1;
    const endYrStr = endYr.toString().length === 4 ? endYr.toString().slice(-2) : endYr.toString().padStart(2, "0");
    return `${startYr}-${endYrStr}`;
  }

  // Pattern YYYY-Q1
  const qMatch = period.match(/^(\d{4})-Q([1-4])$/i);
  if (qMatch) {
    let yr = parseInt(qMatch[1], 10);
    let q = parseInt(qMatch[2], 10) + 1;
    if (q > 4) {
      q = 1;
      yr += 1;
    }
    return `${yr}-Q${q}`;
  }

  // Fallback: append next year indicator
  const numMatch = period.match(/(\d{4})/);
  if (numMatch) {
    const yr = parseInt(numMatch[1], 10) + 1;
    return `${yr}-${(yr + 1).toString().slice(-2)}`;
  }

  return currentPeriod;
}

/**
 * Dynamically derives tax status and reminder status based on outstanding amount and due date.
 */
export function deriveTaxStatus(
  outstandingAmount: number,
  totalAmount: number,
  nextDueDate: Date,
): { status: string; reminderStatus: string } {
  const now = new Date();
  const due = new Date(nextDueDate);

  let status = "DUE";
  if (outstandingAmount <= 0) {
    status = "PAID";
  } else if (outstandingAmount < totalAmount) {
    status = "PARTIAL";
  } else if (now > due) {
    status = "OVERDUE";
  }

  // Calculate days until due date
  const diffTime = due.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let reminderStatus = "UPCOMING";
  if (outstandingAmount <= 0) {
    reminderStatus = "SETTLED";
  } else if (diffDays < 0) {
    reminderStatus = "OVERDUE";
  } else if (diffDays === 0) {
    reminderStatus = "DUE_TODAY";
  } else if (diffDays === 1) {
    reminderStatus = "DUE_TOMORROW";
  } else if (diffDays <= 7) {
    reminderStatus = "DUE_SOON";
  } else if (diffDays <= 30) {
    reminderStatus = "UPCOMING";
  }

  return { status, reminderStatus };
}
