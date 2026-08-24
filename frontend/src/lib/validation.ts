// Centralized validation utilities for C2D Rent Management forms

/**
 * Normalizes an Indian phone number string to 10 digits
 */
export function cleanPhoneDigits(val: string): string {
  const digits = (val || "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/**
 * Formats a phone input on change (preserves clean 10 digits)
 */
export function formatPhoneInput(val: string): string {
  const cleaned = cleanPhoneDigits(val);
  return cleaned.slice(0, 10);
}

/**
 * Cleans Aadhaar number to 12 digits
 */
export function cleanAadhaarDigits(val: string): string {
  return (val || "").replace(/\D/g, "").slice(0, 12);
}

/**
 * Formats Aadhaar with spaces: "XXXX XXXX XXXX"
 */
export function formatAadhaarInput(val: string): string {
  const digits = cleanAadhaarDigits(val);
  const parts: string[] = [];
  for (let i = 0; i < digits.length; i += 4) {
    parts.push(digits.slice(i, i + 4));
  }
  return parts.join(" ");
}

/**
 * Validates full name
 */
export function validateName(
  name: string | undefined | null,
  required = true,
  fieldName = "Name"
): string | null {
  const trimmed = (name || "").trim();
  if (!trimmed) {
    return required ? `${fieldName} is required` : null;
  }
  if (trimmed.length < 2) {
    return `${fieldName} must be at least 2 characters long`;
  }
  if (trimmed.length > 80) {
    return `${fieldName} must not exceed 80 characters`;
  }
  if (!/^[a-zA-Z\s.'-]+$/.test(trimmed)) {
    return `${fieldName} should contain only letters and standard characters`;
  }
  return null;
}

/**
 * Validates Indian 10-digit mobile number
 */
export function validatePhone(
  phone: string | undefined | null,
  required = true,
  fieldName = "Phone number"
): string | null {
  const trimmed = (phone || "").trim();
  if (!trimmed) {
    return required ? `${fieldName} is required` : null;
  }
  const digits = cleanPhoneDigits(trimmed);
  if (digits.length !== 10) {
    return `${fieldName} must be a 10-digit mobile number`;
  }
  if (!/^[6-9]\d{9}$/.test(digits)) {
    return `${fieldName} must start with 6, 7, 8, or 9`;
  }
  return null;
}

/**
 * Validates standard email address
 */
export function validateEmail(
  email: string | undefined | null,
  required = false,
  fieldName = "Email address"
): string | null {
  const trimmed = (email || "").trim();
  if (!trimmed) {
    return required ? `${fieldName} is required` : null;
  }
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return "Please enter a valid email address (e.g. name@example.com)";
  }
  return null;
}

/**
 * Validates 12-digit Indian Aadhaar number
 */
export function validateAadhaar(
  aadhaar: string | undefined | null,
  required = false,
  fieldName = "Aadhaar number"
): string | null {
  const trimmed = (aadhaar || "").trim();
  if (!trimmed) {
    return required ? `${fieldName} is required` : null;
  }
  if (trimmed.startsWith("DEMO-")) return null;

  const digits = cleanAadhaarDigits(trimmed);
  if (digits.length !== 12) {
    return `${fieldName} must be exactly 12 digits (e.g. 1234 5678 9012)`;
  }
  if (/^(\d)\1{11}$/.test(digits)) {
    return "Please enter a valid 12-digit Aadhaar number";
  }
  return null;
}
