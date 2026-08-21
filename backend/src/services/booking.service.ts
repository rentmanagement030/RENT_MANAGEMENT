import { Prisma, BookingStatus, PaymentMethod } from "@prisma/client";
import { prisma } from "../config/prisma";
import { NotFoundError, ConflictError, BadRequestError } from "../utils/http";
import { buildPagination, parsePagination } from "../utils/pagination";

export interface CreateBookingInput {
  leadId?: string;
  tenantId?: string;
  propertyId: string;
  roomId: string;
  bedId: string;
  tokenAmount: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
}

export async function listBookings(query: Record<string, unknown>) {
  const { page, pageSize } = parsePagination(query);
  const status = query.status ? (query.status as BookingStatus) : undefined;
  const propertyId = query.propertyId ? String(query.propertyId) : undefined;

  const where: Prisma.BookingWhereInput = {
    ...(status ? { status } : {}),
    ...(propertyId ? { propertyId } : {}),
  };

  const [total, bookings] = await Promise.all([
    prisma.booking.count({ where }),
    prisma.booking.findMany({
      where,
      include: {
        lead: { select: { id: true, name: true, phone: true } },
        tenant: { select: { id: true, name: true, phone: true } },
        property: { select: { id: true, name: true } },
        room: { select: { id: true, roomNumber: true } },
        bed: { select: { id: true, bedNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return buildPagination(bookings, total, { page, pageSize });
}

export async function createBookingTransactionSafe(input: CreateBookingInput) {
  if (!input.propertyId || !input.roomId || !input.bedId || !input.tokenAmount) {
    throw new BadRequestError("Property, Room, Bed, and Token Amount are required for booking");
  }

  const bookingNumber = `BKG-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;
  const expiryDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days token validity

  // Interactive transaction for double-booking prevention
  const booking = await prisma.$transaction(async (tx) => {
    // 1. Fetch target bed status with transaction lock
    const bed = await tx.pgBed.findUnique({
      where: { id: input.bedId },
      include: { room: true },
    });

    if (!bed) {
      throw new NotFoundError("Bed not found");
    }

    if (bed.status !== "AVAILABLE") {
      throw new ConflictError(`Bed ${bed.bedNumber} is no longer available (Current Status: ${bed.status}). Only ONE booking can succeed.`);
    }

    // 2. Update bed status to RESERVED atomically
    await tx.pgBed.update({
      where: { id: input.bedId },
      data: { status: "RESERVED" },
    });

    // 3. Create Booking Record
    const newBooking = await tx.booking.create({
      data: {
        bookingNumber,
        leadId: input.leadId || null,
        tenantId: input.tenantId || null,
        propertyId: input.propertyId,
        roomId: input.roomId,
        bedId: input.bedId,
        tokenAmount: new Prisma.Decimal(input.tokenAmount),
        paymentMethod: input.paymentMethod || "CASH",
        bookingDate: new Date(),
        expiryDate,
        status: "RESERVED",
        notes: input.notes || null,
      },
    });

    // 4. Update Lead status if lead provided
    if (input.leadId) {
      await tx.lead.update({
        where: { id: input.leadId },
        data: { status: "TOKEN_PAID" },
      });

      await tx.leadActivity.create({
        data: {
          leadId: input.leadId,
          action: "TOKEN_PAID",
          notes: `Token payment of ₹${input.tokenAmount} received. Reserved Bed ${bed.bedNumber}. Booking: ${bookingNumber}`,
        },
      });
    }

    return newBooking;
  });

  return booking;
}

export async function cancelBooking(id: string, reason?: string) {
  return prisma.$transaction(async (tx) => {
    const booking = await tx.booking.findUnique({ where: { id } });
    if (!booking) throw new NotFoundError("Booking not found");

    if (booking.status === "CANCELLED" || booking.status === "EXPIRED") {
      return booking;
    }

    const updated = await tx.booking.update({
      where: { id },
      data: {
        status: "CANCELLED",
        notes: reason ? `${booking.notes || ""}\nCancelled: ${reason}` : booking.notes,
      },
    });

    // Release bed back to AVAILABLE if it was reserved by this booking
    const bed = await tx.pgBed.findUnique({ where: { id: booking.bedId } });
    if (bed && bed.status === "RESERVED") {
      await tx.pgBed.update({
        where: { id: booking.bedId },
        data: { status: "AVAILABLE" },
      });
    }

    return updated;
  });
}
