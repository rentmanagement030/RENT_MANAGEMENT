import PDFDocument from "pdfkit";
import { prisma } from "../config/prisma";
import { NotFoundError } from "../utils/http";
import { numberMoney } from "../utils/money";

export async function generateReceiptPdf(paymentId: string): Promise<Buffer> {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      tenant: { select: { id: true, name: true, phone: true } },
      property: { select: { id: true, name: true, number: true, address: true, city: true } },
      rentRecord: { select: { billingMonth: true } },
      allocations: { include: { bill: { select: { billingMonth: true, billNumber: true } } } },
      createdBy: { select: { name: true } },
    },
  });
  if (!payment) throw new NotFoundError("Payment not found");

  const settings = await prisma.setting.findMany();
  const get = (key: string) => {
    const s = settings.find((x) => x.key === key);
    return s ? String((s.value as { v?: string })?.v ?? JSON.stringify(s.value)).replace(/^"|"$/g, "") : "";
  };
  const businessName = get("businessName") || "C2D Tech Rentals";
  const businessPhone = get("businessPhone") || "";
  const businessEmail = get("businessEmail") || "";
  const businessAddress = get("businessAddress") || "";
  const currency = get("currency") || "₹";

  const doc = new PDFDocument({ size: "A5", margin: 40 });
  const chunks: Buffer[] = [];
  doc.on("data", (c) => chunks.push(c));

  const methodLabels: Record<string, string> = {
    RAZORPAY_UPI: "UPI (Razorpay)",
    CASH: "Cash",
    BANK_TRANSFER_DD: "Bank Transfer / DD",
  };

  doc.fontSize(16).fillColor("#0f172a").text(businessName, { align: "center" });
  if (businessAddress) doc.fontSize(9).fillColor("#475569").text(businessAddress, { align: "center" });
  if (businessPhone) doc.fontSize(9).fillColor("#475569").text(`Phone: ${businessPhone}`, { align: "center" });
  if (businessEmail) doc.fontSize(9).fillColor("#475569").text(`Email: ${businessEmail}`, { align: "center" });

  doc.moveDown(0.5);
  doc.fontSize(14).fillColor("#0f172a").text("PAYMENT RECEIPT", { align: "center", underline: true });
  doc.moveDown(0.5);

  doc.fontSize(10).fillColor("#334155");
  const rows: [string, string][] = [
    ["Receipt No.", payment.receiptNumber ?? "-"],
    ["Date", payment.paymentDate.toISOString().slice(0, 10)],
    ["Received From", payment.tenant.name],
    ["Contact", payment.tenant.phone],
    ["Property", `${payment.property.name}${payment.property.number ? ` (${payment.property.number})` : ""}`],
    ["Rent Period", payment.rentRecord ? payment.rentRecord.billingMonth : (payment.allocations[0]?.bill?.billingMonth ?? "-")],
    ["Payment Method", methodLabels[payment.paymentMethod] ?? payment.paymentMethod],
  ];
  if (payment.razorpayPaymentId) rows.push(["Razorpay Payment ID", payment.razorpayPaymentId]);
  if (payment.bankReferenceNumber) rows.push(["Reference No.", payment.bankReferenceNumber]);
  if (payment.ddNumber) rows.push(["DD Number", payment.ddNumber]);

  rows.forEach(([k, v]) => {
    doc.text(`${k}: ${v}`, { continued: false });
    doc.moveDown(0.2);
  });

  doc.moveDown(0.7);
  doc.font("Helvetica-Bold").fontSize(13).fillColor("#059669").text(
    `Amount: ${currency}${numberMoney(payment.amount).toFixed(2)}`,
    { align: "center" },
  );
  doc.font("Helvetica").moveDown(0.8);

  doc.fontSize(9).fillColor("#64748b").text("This is a computer-generated receipt.", { align: "center" });
  if (payment.createdBy?.name) {
    doc.fontSize(9).fillColor("#64748b").text(`Authorized by: ${payment.createdBy.name}`, { align: "center" });
  }
  doc.text(`Status: ${payment.paymentStatus === "SUCCESS" || payment.paymentStatus === "VERIFIED" ? "PAID" : payment.paymentStatus}`, { align: "center" });

  doc.end();

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}
