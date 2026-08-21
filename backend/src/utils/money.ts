import { Prisma } from "@prisma/client";

export type Money = Prisma.Decimal;

export const DECIMAL_PLACES = 2;

export const toDecimal = (value: number | string | Prisma.Decimal): Prisma.Decimal =>
  new Prisma.Decimal(value.toString());

export const zero = (): Prisma.Decimal => new Prisma.Decimal(0);

export const add = (a: Prisma.Decimal | number, b: Prisma.Decimal | number): Prisma.Decimal =>
  toDecimal(a).plus(b).toDecimalPlaces(DECIMAL_PLACES, Prisma.Decimal.ROUND_HALF_UP);

export const sub = (a: Prisma.Decimal | number, b: Prisma.Decimal | number): Prisma.Decimal =>
  toDecimal(a).minus(b).toDecimalPlaces(DECIMAL_PLACES, Prisma.Decimal.ROUND_HALF_UP);

export const neg = (a: Prisma.Decimal | number): Prisma.Decimal =>
  toDecimal(a).negated().toDecimalPlaces(DECIMAL_PLACES, Prisma.Decimal.ROUND_HALF_UP);

export const isPositive = (a: Prisma.Decimal | number): boolean => toDecimal(a).greaterThan(0);

export const gt = (a: Prisma.Decimal | number, b: Prisma.Decimal | number): boolean =>
  toDecimal(a).greaterThan(b);

export const numberMoney = (a: Prisma.Decimal | number): number => toDecimal(a).toNumber();

export const formatINR = (a: Prisma.Decimal | number): string =>
  "₹" + toDecimal(a).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");

/** Convert a Decimal to integer paise for Razorpay. */
export const toPaise = (a: Prisma.Decimal | number): number =>
  Math.round(toDecimal(a).times(100).toNumber());
