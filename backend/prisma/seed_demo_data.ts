import "dotenv/config";
import { prisma } from "../src/config/prisma";
import { logger } from "../src/utils/logger";
import { Prisma } from "@prisma/client";

/**
 * Idempotent Seed Script for C2D Rental Management System
 * Populates EXACTLY 10 records for each requested entity.
 */
async function main() {
  logger.info("Starting Idempotent Demo Data Seed...");

  // 1. Fetch Existing Base Infrastructure Properties & Rooms/Beds
  const properties = await prisma.property.findMany({
    include: {
      rooms: {
        include: { beds: true },
      },
    },
  });

  const pgProp = properties.find((p) => p.type === "PG") || properties[0];
  const houseProps = properties.filter((p) => p.type === "HOUSE");
  const house1 = houseProps[0] || pgProp;
  const house2 = houseProps[1] || house1;
  const house3 = houseProps[2] || house2;

  const pgBeds = pgProp.rooms.flatMap((r) => r.beds);
  const bed1 = pgBeds[0];
  const bed2 = pgBeds[1];
  const bed3 = pgBeds[2];
  const bed4 = pgBeds[3];
  const bed5 = pgBeds[4];
  const bed6 = pgBeds[5];
  const bed7 = pgBeds[6];

  // -------------------------------------------------------------------------
  // 1. STAFF DIRECTORY (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Staff Members...");
  const staffData = [
    { name: "Murugan K", phone: "9000000101", email: "murugan@c2dtech.in", role: "CARETAKER" },
    { name: "Selvam R", phone: "9000000102", email: "selvam@c2dtech.in", role: "CARETAKER" },
    { name: "Anand P", phone: "9000000103", email: "anand@c2dtech.in", role: "MANAGER" },
    { name: "Deepa S", phone: "9000000104", email: "deepa@c2dtech.in", role: "MANAGER" },
    { name: "Kavitha M", phone: "9000000105", email: "kavitha@c2dtech.in", role: "CLEANER" },
    { name: "Lakshmi T", phone: "9000000106", email: "lakshmi@c2dtech.in", role: "CLEANER" },
    { name: "Ramu N", phone: "9000000107", email: "ramu@c2dtech.in", role: "SECURITY" },
    { name: "Velu K", phone: "9000000108", email: "velu@c2dtech.in", role: "SECURITY" },
    { name: "Saravanan V", phone: "9000000109", email: "saravanan@c2dtech.in", role: "CARETAKER" },
    { name: "Radha B", phone: "9000000110", email: "radha@c2dtech.in", role: "CLEANER" },
  ];

  const staffList = [];
  for (const s of staffData) {
    const record = await prisma.staff.upsert({
      where: { phone: s.phone },
      update: s,
      create: s,
    });
    staffList.push(record);
  }

  // -------------------------------------------------------------------------
  // 2. VENDOR DIRECTORY (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Vendors...");
  const vendorData = [
    { name: "Chennai Electrical Solutions", phone: "9100000201", service: "ELECTRICIAN", company: "Apex Power Services" },
    { name: "Metro Plumbing Works", phone: "9100000202", service: "PLUMBER", company: "Metro Care" },
    { name: "Royal Carpentry Care", phone: "9100000203", service: "CARPENTER", company: "Royal Interiors" },
    { name: "SpeedNet Broadband Services", phone: "9100000204", service: "INTERNET", company: "SpeedNet Telecom" },
    { name: "CleanCare Facility Management", phone: "9100000205", service: "CLEANING", company: "CleanCare Pvt Ltd" },
    { name: "CoolBlast AC Services", phone: "9100000206", service: "AC_SERVICE", company: "CoolBlast India" },
    { name: "Rainbow House Painting", phone: "9100000207", service: "PAINTER", company: "Rainbow Paints" },
    { name: "AquaPure Water Tech", phone: "9100000208", service: "WATER_SERVICE", company: "AquaPure Tech" },
    { name: "Apex Electrical Agency", phone: "9100000209", service: "ELECTRICIAN", company: "Apex Electrics" },
    { name: "Citywide Plumbing Agency", phone: "9100000210", service: "PLUMBER", company: "Citywide Plumbers" },
  ];

  const vendorList = [];
  for (const v of vendorData) {
    let record = await prisma.vendor.findFirst({ where: { phone: v.phone } });
    if (!record) {
      record = await prisma.vendor.create({ data: v });
    }
    vendorList.push(record);
  }

  // -------------------------------------------------------------------------
  // 3. TENANTS (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Tenants...");
  const tenantRaw = [
    {
      name: "Arun Kumar",
      phone: "9876543201",
      email: "arun.kumar@demo.in",
      address: "12 Gandhi Street, Madurai",
      aadhaarNumber: "DEMO-AADHAAR-001",
      emergencyName: "Sundaram Kumar",
      emergencyPhone: "9876543291",
      joiningDate: new Date("2026-01-15"),
      status: "ACTIVE" as const,
      kycStatus: "VERIFIED" as const,
      notes: "Software Engineer at OMR IT Park",
      rent: new Prisma.Decimal(8500),
      advance: new Prisma.Decimal(17000),
      deposit: new Prisma.Decimal(25000),
      propertyId: pgProp.id,
      roomId: bed1?.roomId || null,
    },
    {
      name: "Ramesh Kumar",
      phone: "9876543202",
      email: "ramesh.k@demo.in",
      address: "45 Station Road, Trichy",
      aadhaarNumber: "DEMO-AADHAAR-002",
      emergencyName: "Vijay Kumar",
      emergencyPhone: "9876543292",
      joiningDate: new Date("2026-02-01"),
      status: "ACTIVE" as const,
      kycStatus: "VERIFIED" as const,
      notes: "Senior Analyst at Global Solutions",
      rent: new Prisma.Decimal(8500),
      advance: new Prisma.Decimal(17000),
      deposit: new Prisma.Decimal(25000),
      propertyId: pgProp.id,
      roomId: bed2?.roomId || null,
    },
    {
      name: "Santhosh M",
      phone: "9876543203",
      email: "santhosh.m@demo.in",
      address: "88 Main Bazar, Salem",
      aadhaarNumber: "DEMO-AADHAAR-003",
      emergencyName: "Anitha M",
      emergencyPhone: "9876543293",
      joiningDate: new Date("2026-03-10"),
      status: "ACTIVE" as const,
      kycStatus: "VERIFIED" as const,
      notes: "Product Specialist at TechCorp",
      rent: new Prisma.Decimal(9000),
      advance: new Prisma.Decimal(18000),
      deposit: new Prisma.Decimal(25000),
      propertyId: pgProp.id,
      roomId: bed3?.roomId || null,
    },
    {
      name: "Karthik Raj",
      phone: "9876543204",
      email: "karthik.r@demo.in",
      address: "23 Cross Street, Coimbatore",
      aadhaarNumber: "DEMO-AADHAAR-004",
      emergencyName: "Priya Raj",
      emergencyPhone: "9876543294",
      joiningDate: new Date("2026-04-01"),
      status: "ACTIVE" as const,
      kycStatus: "DOCUMENTS_PENDING" as const,
      notes: "UX Designer at Creative Studio",
      rent: new Prisma.Decimal(9000),
      advance: new Prisma.Decimal(18000),
      deposit: new Prisma.Decimal(25000),
      propertyId: pgProp.id,
      roomId: bed4?.roomId || null,
    },
    {
      name: "Praveen Kumar",
      phone: "9876543205",
      email: "praveen.k@demo.in",
      address: "10 Temple Avenue, Thanjavur",
      aadhaarNumber: "DEMO-AADHAAR-005",
      emergencyName: "Rohan Kumar",
      emergencyPhone: "9876543295",
      joiningDate: new Date("2026-05-15"),
      status: "ACTIVE" as const,
      kycStatus: "VERIFIED" as const,
      notes: "Renting entire Green View House",
      rent: new Prisma.Decimal(18000),
      advance: new Prisma.Decimal(36000),
      deposit: new Prisma.Decimal(50000),
      propertyId: house1.id,
      roomId: null,
    },
    {
      name: "Vignesh S",
      phone: "9876543206",
      email: "vignesh.s@demo.in",
      address: "7 North Street, Vellore",
      aadhaarNumber: "DEMO-AADHAAR-006",
      emergencyName: "Suresh S",
      emergencyPhone: "9876543296",
      joiningDate: new Date("2026-06-01"),
      status: "ACTIVE" as const,
      kycStatus: "VERIFIED" as const,
      notes: "Renting Sunrise Apartment 2BHK",
      rent: new Prisma.Decimal(20000),
      advance: new Prisma.Decimal(40000),
      deposit: new Prisma.Decimal(60000),
      propertyId: house2.id,
      roomId: null,
    },
    {
      name: "Dinesh Kumar",
      phone: "9876543207",
      email: "dinesh.k@demo.in",
      address: "19 Lake View, Erode",
      aadhaarNumber: "DEMO-AADHAAR-007",
      emergencyName: "Kavitha Kumar",
      emergencyPhone: "9876543297",
      joiningDate: new Date("2026-07-01"),
      status: "PENDING" as const,
      kycStatus: "DOCUMENTS_PENDING" as const,
      notes: "Move-in scheduled for next week",
      rent: new Prisma.Decimal(9500),
      advance: new Prisma.Decimal(19000),
      deposit: new Prisma.Decimal(25000),
      propertyId: pgProp.id,
      roomId: bed6?.roomId || null,
    },
    {
      name: "Harish R",
      phone: "9876543208",
      email: "harish.r@demo.in",
      address: "34 Park Road, Tirunelveli",
      aadhaarNumber: "DEMO-AADHAAR-008",
      emergencyName: "Ramesh R",
      emergencyPhone: "9876543298",
      joiningDate: new Date("2026-07-15"),
      status: "PENDING" as const,
      kycStatus: "NOT_STARTED" as const,
      notes: "Awaiting final KYC documents",
      rent: new Prisma.Decimal(9500),
      advance: new Prisma.Decimal(19000),
      deposit: new Prisma.Decimal(25000),
      propertyId: pgProp.id,
      roomId: bed7?.roomId || null,
    },
    {
      name: "Naveen Kumar",
      phone: "9876543209",
      email: "naveen.k@demo.in",
      address: "5 West Mada Street, Kanchipuram",
      aadhaarNumber: "DEMO-AADHAAR-009",
      emergencyName: "Prakash N",
      emergencyPhone: "9876543299",
      joiningDate: new Date("2025-11-01"),
      status: "FORMER" as const,
      kycStatus: "REJECTED" as const,
      notes: "Vacated PG in June 2026",
      rent: new Prisma.Decimal(9000),
      advance: new Prisma.Decimal(18000),
      deposit: new Prisma.Decimal(25000),
      propertyId: pgProp.id,
      roomId: null,
    },
    {
      name: "Ajay Krishnan",
      phone: "9876543210",
      email: "ajay.k@demo.in",
      address: "88 South Street, Nagercoil",
      aadhaarNumber: "DEMO-AADHAAR-010",
      emergencyName: "Meena Krishnan",
      emergencyPhone: "9876543200",
      joiningDate: new Date("2025-10-01"),
      status: "INACTIVE" as const,
      kycStatus: "REJECTED" as const,
      notes: "Inactive tenant profile",
      rent: new Prisma.Decimal(25000),
      advance: new Prisma.Decimal(50000),
      deposit: new Prisma.Decimal(75000),
      propertyId: house3.id,
      roomId: null,
    },
  ];

  const tenantList = [];
  for (const t of tenantRaw) {
    const record = await prisma.tenant.upsert({
      where: { phone: t.phone },
      update: t,
      create: t,
    });
    tenantList.push(record);
  }

  // Link PG Beds to active tenants
  if (bed1) await prisma.pgBed.update({ where: { id: bed1.id }, data: { status: "OCCUPIED", tenantId: tenantList[0].id } });
  if (bed2) await prisma.pgBed.update({ where: { id: bed2.id }, data: { status: "OCCUPIED", tenantId: tenantList[1].id } });
  if (bed3) await prisma.pgBed.update({ where: { id: bed3.id }, data: { status: "OCCUPIED", tenantId: tenantList[2].id } });
  if (bed4) await prisma.pgBed.update({ where: { id: bed4.id }, data: { status: "OCCUPIED", tenantId: tenantList[3].id } });
  if (house1) await prisma.property.update({ where: { id: house1.id }, data: { status: "OCCUPIED" } });
  if (house2) await prisma.property.update({ where: { id: house2.id }, data: { status: "OCCUPIED" } });

  // -------------------------------------------------------------------------
  // 4. FAMILY & DEPENDENTS (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Family Members...");
  const familyRaw = [
    { tenantId: tenantList[0].id, name: "Sundaram Kumar", relation: "Father", phone: "9876543291", age: 58, occupation: "Farmer", isDependent: true },
    { tenantId: tenantList[0].id, name: "Lakshmi Kumar", relation: "Mother", phone: "9876543290", age: 52, occupation: "Homemaker", isDependent: true },
    { tenantId: tenantList[1].id, name: "Vijay Kumar", relation: "Brother", phone: "9876543292", age: 26, occupation: "Software Engineer", isDependent: false },
    { tenantId: tenantList[2].id, name: "Anitha M", relation: "Sister", phone: "9876543293", age: 24, occupation: "Accountant", isDependent: false },
    { tenantId: tenantList[3].id, name: "Priya Raj", relation: "Spouse", phone: "9876543294", age: 27, occupation: "Designer", isDependent: true },
    { tenantId: tenantList[4].id, name: "Rohan Kumar", relation: "Child", phone: null, age: 4, occupation: "Student", isDependent: true },
    { tenantId: tenantList[5].id, name: "Suresh S", relation: "Father", phone: "9876543296", age: 60, occupation: "Retired Teacher", isDependent: true },
    { tenantId: tenantList[6].id, name: "Kavitha Kumar", relation: "Spouse", phone: "9876543297", age: 26, occupation: "HR Executive", isDependent: false },
    { tenantId: tenantList[7].id, name: "Ramesh R", relation: "Father", phone: "9876543298", age: 56, occupation: "Business", isDependent: false },
    { tenantId: tenantList[9].id, name: "Meena Krishnan", relation: "Mother", phone: "9876543200", age: 54, occupation: "Teacher", isDependent: true },
  ];

  await prisma.familyMember.deleteMany({ where: { tenantId: { in: tenantList.map((t) => t.id) } } });
  for (const f of familyRaw) {
    await prisma.familyMember.create({ data: f });
  }

  // -------------------------------------------------------------------------
  // 5. KYC DOCUMENTS (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 KYC Documents...");
  const kycRaw = [
    {
      tenantId: tenantList[0].id,
      type: "AADHAAR" as const,
      storageKey: "demo_aadhaar_001.pdf",
      originalName: "Aadhaar_Arun_Kumar.pdf",
      mimeType: "application/pdf",
      size: 452100,
      status: "VERIFIED" as const,
      verificationConfidence: new Prisma.Decimal(96.4),
      verificationReason: "Name and DOB match submitted profile",
      ocrData: { nameExtracted: "Arun Kumar", docNumber: "DEMO-AADHAAR-001", dob: "1997-04-12" },
      verifiedAt: new Date("2026-01-16"),
    },
    {
      tenantId: tenantList[1].id,
      type: "PAN" as const,
      storageKey: "demo_pan_002.pdf",
      originalName: "PAN_Ramesh_Kumar.pdf",
      mimeType: "application/pdf",
      size: 320400,
      status: "VERIFIED" as const,
      verificationConfidence: new Prisma.Decimal(91.8),
      verificationReason: "Verified against NSDL database",
      ocrData: { nameExtracted: "Ramesh Kumar", docNumber: "DEMO-PAN-002", dob: "1996-08-20" },
      verifiedAt: new Date("2026-02-02"),
    },
    {
      tenantId: tenantList[2].id,
      type: "AADHAAR" as const,
      storageKey: "demo_aadhaar_003.pdf",
      originalName: "Aadhaar_Santhosh_M.pdf",
      mimeType: "application/pdf",
      size: 489000,
      status: "VERIFIED" as const,
      verificationConfidence: new Prisma.Decimal(88.5),
      verificationReason: "Clear photo and valid QR code",
      ocrData: { nameExtracted: "Santhosh M", docNumber: "DEMO-AADHAAR-003", dob: "1995-11-05" },
      verifiedAt: new Date("2026-03-11"),
    },
    {
      tenantId: tenantList[3].id,
      type: "DRIVING_LICENSE" as const,
      storageKey: "demo_dl_004.pdf",
      originalName: "DL_Karthik_Raj.pdf",
      mimeType: "application/pdf",
      size: 512000,
      status: "PENDING" as const,
      verificationConfidence: new Prisma.Decimal(97.1),
      verificationReason: "Awaiting reviewer confirmation",
      ocrData: { nameExtracted: "Karthik Raj", docNumber: "DEMO-DL-004", dob: "1998-02-14" },
    },
    {
      tenantId: tenantList[4].id,
      type: "AGREEMENT" as const,
      storageKey: "demo_agreement_005.pdf",
      originalName: "Agreement_Praveen.pdf",
      mimeType: "application/pdf",
      size: 1024000,
      status: "VERIFIED" as const,
      verificationConfidence: new Prisma.Decimal(93.6),
      verificationReason: "Signed lease document verified",
      ocrData: { nameExtracted: "Praveen Kumar", docNumber: "DEMO-AGR-005", startDate: "2026-05-15" },
      verifiedAt: new Date("2026-05-16"),
    },
    {
      tenantId: tenantList[5].id,
      type: "PASSPORT" as const,
      storageKey: "demo_passport_006.pdf",
      originalName: "Passport_Vignesh_S.pdf",
      mimeType: "application/pdf",
      size: 780000,
      status: "VERIFIED" as const,
      verificationConfidence: new Prisma.Decimal(85.2),
      verificationReason: "Valid passport expiry date",
      ocrData: { nameExtracted: "Vignesh S", docNumber: "DEMO-PASS-006", expiryDate: "2032-10-10" },
      verifiedAt: new Date("2026-06-02"),
    },
    {
      tenantId: tenantList[6].id,
      type: "AADHAAR" as const,
      storageKey: "demo_aadhaar_007.pdf",
      originalName: "Aadhaar_Dinesh.pdf",
      mimeType: "application/pdf",
      size: 410000,
      status: "PENDING" as const,
      verificationConfidence: new Prisma.Decimal(98.0),
      verificationReason: "Pending onboarding approval",
      ocrData: { nameExtracted: "Dinesh Kumar", docNumber: "DEMO-AADHAAR-007", dob: "1999-06-18" },
    },
    {
      tenantId: tenantList[7].id,
      type: "PHOTO" as const,
      storageKey: "demo_photo_008.jpg",
      originalName: "Photo_Harish.jpg",
      mimeType: "image/jpeg",
      size: 180000,
      status: "PENDING" as const,
      verificationConfidence: new Prisma.Decimal(90.4),
      verificationReason: "High resolution portrait photo",
      ocrData: { nameExtracted: "Harish R", docNumber: "DEMO-PHOTO-008" },
    },
    {
      tenantId: tenantList[8].id,
      type: "PAN" as const,
      storageKey: "demo_pan_009.pdf",
      originalName: "PAN_Naveen.pdf",
      mimeType: "application/pdf",
      size: 290000,
      status: "REJECTED" as const,
      rejectionReason: "Blurry image copy",
      verificationConfidence: new Prisma.Decimal(94.7),
      verificationReason: "Unreadable PAN digits",
      ocrData: { nameExtracted: "Naveen Kumar", docNumber: "DEMO-PAN-009" },
    },
    {
      tenantId: tenantList[9].id,
      type: "AADHAAR" as const,
      storageKey: "demo_aadhaar_010.pdf",
      originalName: "Aadhaar_Ajay.pdf",
      mimeType: "application/pdf",
      size: 430000,
      status: "REJECTED" as const,
      rejectionReason: "Name mismatch with Aadhaar portal",
      verificationConfidence: new Prisma.Decimal(87.9),
      verificationReason: "Submitted name differs from official database",
      ocrData: { nameExtracted: "Ajay Krishnan", docNumber: "DEMO-AADHAAR-010" },
    },
  ];

  await prisma.tenantDocument.deleteMany({ where: { tenantId: { in: tenantList.map((t) => t.id) } } });
  for (const k of kycRaw) {
    await prisma.tenantDocument.create({ data: k });
  }

  // -------------------------------------------------------------------------
  // 6. TENANT TRANSFER HISTORY (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Transfer History Records...");
  const transferRaw = [
    {
      tenantId: tenantList[0].id,
      fromPropertyId: pgProp.id,
      fromRoomId: pgProp.rooms[1]?.id || null,
      fromBedId: bed3?.id || null,
      fromRent: new Prisma.Decimal(9000),
      toPropertyId: pgProp.id,
      toRoomId: pgProp.rooms[0]?.id || null,
      toBedId: bed1?.id || null,
      toRent: new Prisma.Decimal(8500),
      effectiveFrom: new Date("2026-04-01"),
      reason: "Room change",
      notes: "Tenant request for ground floor room",
    },
    {
      tenantId: tenantList[1].id,
      fromPropertyId: pgProp.id,
      fromRoomId: pgProp.rooms[2]?.id || null,
      fromBedId: bed6?.id || null,
      fromRent: new Prisma.Decimal(9500),
      toPropertyId: pgProp.id,
      toRoomId: pgProp.rooms[0]?.id || null,
      toBedId: bed2?.id || null,
      toRent: new Prisma.Decimal(8500),
      effectiveFrom: new Date("2026-05-01"),
      reason: "Tenant request",
      notes: "Roommate preference transfer",
    },
    {
      tenantId: tenantList[2].id,
      fromPropertyId: pgProp.id,
      fromRoomId: pgProp.rooms[0]?.id || null,
      fromBedId: bed2?.id || null,
      fromRent: new Prisma.Decimal(8500),
      toPropertyId: pgProp.id,
      toRoomId: pgProp.rooms[1]?.id || null,
      toBedId: bed3?.id || null,
      toRent: new Prisma.Decimal(9000),
      effectiveFrom: new Date("2026-06-01"),
      reason: "Bed availability",
      notes: "Transferred to 3-sharing room",
    },
    {
      tenantId: tenantList[3].id,
      fromPropertyId: pgProp.id,
      fromRoomId: pgProp.rooms[0]?.id || null,
      fromBedId: bed1?.id || null,
      fromRent: new Prisma.Decimal(8500),
      toPropertyId: pgProp.id,
      toRoomId: pgProp.rooms[1]?.id || null,
      toBedId: bed4?.id || null,
      toRent: new Prisma.Decimal(9000),
      effectiveFrom: new Date("2026-06-15"),
      reason: "Tenant request",
      notes: "Moved to Room 102 Bed B",
    },
    {
      tenantId: tenantList[4].id,
      fromPropertyId: pgProp.id,
      fromRoomId: pgProp.rooms[2]?.id || null,
      fromBedId: bed7?.id || null,
      fromRent: new Prisma.Decimal(9500),
      toPropertyId: house1.id,
      toRoomId: null,
      toBedId: null,
      toRent: new Prisma.Decimal(18000),
      effectiveFrom: new Date("2026-05-15"),
      reason: "Property transfer",
      notes: "Upgraded from PG bed to entire 2BHK House",
    },
    {
      tenantId: tenantList[5].id,
      fromPropertyId: house1.id,
      fromRoomId: null,
      fromBedId: null,
      fromRent: new Prisma.Decimal(18000),
      toPropertyId: house2.id,
      toRoomId: null,
      toBedId: null,
      toRent: new Prisma.Decimal(20000),
      effectiveFrom: new Date("2026-06-01"),
      reason: "Tenant request",
      notes: "Relocated closer to office in Adyar",
    },
    {
      tenantId: tenantList[6].id,
      fromPropertyId: pgProp.id,
      fromRoomId: pgProp.rooms[0]?.id || null,
      fromBedId: bed1?.id || null,
      fromRent: new Prisma.Decimal(8500),
      toPropertyId: pgProp.id,
      toRoomId: pgProp.rooms[2]?.id || null,
      toBedId: bed6?.id || null,
      toRent: new Prisma.Decimal(9500),
      effectiveFrom: new Date("2026-07-01"),
      reason: "Maintenance relocation",
      notes: "Temporary transfer during AC repair",
    },
    {
      tenantId: tenantList[7].id,
      fromPropertyId: pgProp.id,
      fromRoomId: pgProp.rooms[1]?.id || null,
      fromBedId: bed5?.id || null,
      fromRent: new Prisma.Decimal(9000),
      toPropertyId: pgProp.id,
      toRoomId: pgProp.rooms[2]?.id || null,
      toBedId: bed7?.id || null,
      toRent: new Prisma.Decimal(9500),
      effectiveFrom: new Date("2026-07-15"),
      reason: "Rent revision",
      notes: "Upgraded to Floor 2 Room 201",
    },
    {
      tenantId: tenantList[8].id,
      fromPropertyId: pgProp.id,
      fromRoomId: pgProp.rooms[2]?.id || null,
      fromBedId: bed6?.id || null,
      fromRent: new Prisma.Decimal(9500),
      toPropertyId: pgProp.id,
      toRoomId: pgProp.rooms[1]?.id || null,
      toBedId: bed5?.id || null,
      toRent: new Prisma.Decimal(9000),
      effectiveFrom: new Date("2026-02-01"),
      reason: "Bed availability",
      notes: "Budget optimization transfer",
    },
    {
      tenantId: tenantList[9].id,
      fromPropertyId: house2.id,
      fromRoomId: null,
      fromBedId: null,
      fromRent: new Prisma.Decimal(20000),
      toPropertyId: house3.id,
      toRoomId: null,
      toBedId: null,
      toRent: new Prisma.Decimal(25000),
      effectiveFrom: new Date("2025-10-01"),
      reason: "Property transfer",
      notes: "Transfer to Lakshmi Villa 2BHK",
    },
  ];

  await prisma.tenantTransferHistory.deleteMany({ where: { tenantId: { in: tenantList.map((t) => t.id) } } });
  for (const tr of transferRaw) {
    await prisma.tenantTransferHistory.create({ data: tr });
  }

  // -------------------------------------------------------------------------
  // 7. MONTHLY RENT STATEMENTS (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Rent Records...");
  const rentRaw = [
    { tenantId: tenantList[0].id, propertyId: pgProp.id, billingMonth: "2026-08", dueDate: new Date("2026-08-05"), rent: new Prisma.Decimal(8500), additionalCharges: new Prisma.Decimal(500), previousBalance: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(9000), outstanding: new Prisma.Decimal(0), status: "PAID" as const },
    { tenantId: tenantList[1].id, propertyId: pgProp.id, billingMonth: "2026-08", dueDate: new Date("2026-08-05"), rent: new Prisma.Decimal(8500), additionalCharges: new Prisma.Decimal(500), previousBalance: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(5000), outstanding: new Prisma.Decimal(4000), status: "PARTIAL" as const },
    { tenantId: tenantList[2].id, propertyId: pgProp.id, billingMonth: "2026-08", dueDate: new Date("2026-08-05"), rent: new Prisma.Decimal(9000), additionalCharges: new Prisma.Decimal(0), previousBalance: new Prisma.Decimal(1000), paidAmount: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(10000), status: "PENDING" as const },
    { tenantId: tenantList[3].id, propertyId: pgProp.id, billingMonth: "2026-08", dueDate: new Date("2026-08-05"), rent: new Prisma.Decimal(9000), additionalCharges: new Prisma.Decimal(500), previousBalance: new Prisma.Decimal(1500), paidAmount: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(11000), status: "OVERDUE" as const },
    { tenantId: tenantList[4].id, propertyId: house1.id, billingMonth: "2026-08", dueDate: new Date("2026-08-05"), rent: new Prisma.Decimal(18000), additionalCharges: new Prisma.Decimal(1000), previousBalance: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(19000), outstanding: new Prisma.Decimal(0), status: "PAID" as const },
    { tenantId: tenantList[5].id, propertyId: house2.id, billingMonth: "2026-08", dueDate: new Date("2026-08-05"), rent: new Prisma.Decimal(20000), additionalCharges: new Prisma.Decimal(0), previousBalance: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(10000), outstanding: new Prisma.Decimal(10000), status: "PARTIAL" as const },
    { tenantId: tenantList[0].id, propertyId: pgProp.id, billingMonth: "2026-07", dueDate: new Date("2026-07-05"), rent: new Prisma.Decimal(8500), additionalCharges: new Prisma.Decimal(0), previousBalance: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(8500), outstanding: new Prisma.Decimal(0), status: "PAID" as const },
    { tenantId: tenantList[4].id, propertyId: house1.id, billingMonth: "2026-07", dueDate: new Date("2026-07-05"), rent: new Prisma.Decimal(18000), additionalCharges: new Prisma.Decimal(0), previousBalance: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(18000), outstanding: new Prisma.Decimal(0), status: "PAID" as const },
    { tenantId: tenantList[8].id, propertyId: pgProp.id, billingMonth: "2026-06", dueDate: new Date("2026-06-05"), rent: new Prisma.Decimal(9000), additionalCharges: new Prisma.Decimal(500), previousBalance: new Prisma.Decimal(500), paidAmount: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(10000), status: "OVERDUE" as const },
    { tenantId: tenantList[9].id, propertyId: house3.id, billingMonth: "2026-05", dueDate: new Date("2026-05-05"), rent: new Prisma.Decimal(25000), additionalCharges: new Prisma.Decimal(1000), previousBalance: new Prisma.Decimal(0), paidAmount: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(26000), status: "OVERDUE" as const },
  ];

  const rentList = [];
  for (const r of rentRaw) {
    const record = await prisma.rentRecord.upsert({
      where: { tenantId_billingMonth: { tenantId: r.tenantId, billingMonth: r.billingMonth } },
      update: r,
      create: r,
    });
    rentList.push(record);
  }

  const adminUser = await prisma.user.findFirst();
  const adminId = adminUser?.id || null;

  // -------------------------------------------------------------------------
  // 8. RENT ADJUSTMENTS (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Rent Adjustments...");
  const adjRaw = [
    { rentRecordId: rentList[0].id, type: "CHARGE", amount: new Prisma.Decimal(500), reason: "Late fee for delayed rent payment", adjustedById: adminId },
    { rentRecordId: rentList[1].id, type: "CHARGE", amount: new Prisma.Decimal(500), reason: "Utility extra usage charge", adjustedById: adminId },
    { rentRecordId: rentList[2].id, type: "CHARGE", amount: new Prisma.Decimal(1000), reason: "Previous balance carryforward", adjustedById: adminId },
    { rentRecordId: rentList[3].id, type: "DISCOUNT", amount: new Prisma.Decimal(500), reason: "Early payment concession credit", adjustedById: adminId },
    { rentRecordId: rentList[4].id, type: "CHARGE", amount: new Prisma.Decimal(1000), reason: "Car parking space charge", adjustedById: adminId },
    { rentRecordId: rentList[5].id, type: "DISCOUNT", amount: new Prisma.Decimal(500), reason: "Maintenance inconvenience credit", adjustedById: adminId },
    { rentRecordId: rentList[6].id, type: "CHARGE", amount: new Prisma.Decimal(300), reason: "Waste management charge", adjustedById: adminId },
    { rentRecordId: rentList[7].id, type: "DISCOUNT", amount: new Prisma.Decimal(800), reason: "Special seasonal discount", adjustedById: adminId },
    { rentRecordId: rentList[8].id, type: "CHARGE", amount: new Prisma.Decimal(500), reason: "Overdue interest charge", adjustedById: adminId },
    { rentRecordId: rentList[9].id, type: "CHARGE", amount: new Prisma.Decimal(1000), reason: "Villa garden maintenance charge", adjustedById: adminId },
  ];

  await prisma.rentAdjustment.deleteMany({ where: { rentRecordId: { in: rentList.map((r) => r.id) } } });
  for (const a of adjRaw) {
    await prisma.rentAdjustment.create({ data: a });
  }

  // -------------------------------------------------------------------------
  // 9. MULTI-UTILITY BILLS (10 Bills)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Utility Bills...");
  const billRaw = [
    { billNumber: "BILL-202608-001", tenantId: tenantList[0].id, propertyId: pgProp.id, rentRecordId: rentList[0].id, billType: "EB" as const, billingMonth: "2026-08", dueDate: new Date("2026-08-10"), amount: new Prisma.Decimal(1500), paidAmount: new Prisma.Decimal(1500), outstanding: new Prisma.Decimal(0), status: "PAID" as const },
    { billNumber: "BILL-202608-002", tenantId: tenantList[1].id, propertyId: pgProp.id, rentRecordId: rentList[1].id, billType: "WATER" as const, billingMonth: "2026-08", dueDate: new Date("2026-08-10"), amount: new Prisma.Decimal(500), paidAmount: new Prisma.Decimal(500), outstanding: new Prisma.Decimal(0), status: "PAID" as const },
    { billNumber: "BILL-202608-003", tenantId: tenantList[2].id, propertyId: pgProp.id, rentRecordId: rentList[2].id, billType: "MAINTENANCE" as const, billingMonth: "2026-08", dueDate: new Date("2026-08-10"), amount: new Prisma.Decimal(1000), paidAmount: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(1000), status: "PENDING" as const },
    { billNumber: "BILL-202608-004", tenantId: tenantList[3].id, propertyId: pgProp.id, rentRecordId: rentList[3].id, billType: "LATE_FEE" as const, billingMonth: "2026-08", dueDate: new Date("2026-08-05"), amount: new Prisma.Decimal(750), paidAmount: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(750), status: "OVERDUE" as const },
    { billNumber: "BILL-202608-005", tenantId: tenantList[4].id, propertyId: house1.id, rentRecordId: rentList[4].id, billType: "OTHER" as const, billingMonth: "2026-08", dueDate: new Date("2026-08-10"), amount: new Prisma.Decimal(1000), paidAmount: new Prisma.Decimal(1000), outstanding: new Prisma.Decimal(0), status: "PAID" as const },
    { billNumber: "BILL-202608-006", tenantId: tenantList[5].id, propertyId: house2.id, rentRecordId: rentList[5].id, billType: "OTHER" as const, billingMonth: "2026-08", dueDate: new Date("2026-08-10"), amount: new Prisma.Decimal(350), paidAmount: new Prisma.Decimal(150), outstanding: new Prisma.Decimal(200), status: "PARTIAL" as const },
    { billNumber: "BILL-202608-007", tenantId: tenantList[4].id, propertyId: house1.id, rentRecordId: rentList[4].id, billType: "EB" as const, billingMonth: "2026-08", dueDate: new Date("2026-08-10"), amount: new Prisma.Decimal(2500), paidAmount: new Prisma.Decimal(2500), outstanding: new Prisma.Decimal(0), status: "PAID" as const },
    { billNumber: "BILL-202608-008", tenantId: tenantList[5].id, propertyId: house2.id, rentRecordId: rentList[5].id, billType: "WATER" as const, billingMonth: "2026-08", dueDate: new Date("2026-08-15"), amount: new Prisma.Decimal(750), paidAmount: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(750), status: "PENDING" as const },
    { billNumber: "BILL-202608-009", tenantId: tenantList[9].id, propertyId: house3.id, rentRecordId: rentList[9].id, billType: "MAINTENANCE" as const, billingMonth: "2026-05", dueDate: new Date("2026-05-10"), amount: new Prisma.Decimal(2000), paidAmount: new Prisma.Decimal(0), outstanding: new Prisma.Decimal(2000), status: "OVERDUE" as const },
    { billNumber: "BILL-202608-010", tenantId: tenantList[0].id, propertyId: pgProp.id, rentRecordId: rentList[0].id, billType: "EB" as const, billingMonth: "2026-07", dueDate: new Date("2026-07-10"), amount: new Prisma.Decimal(4500), paidAmount: new Prisma.Decimal(4500), outstanding: new Prisma.Decimal(0), status: "PAID" as const },
  ];

  const billList = [];
  for (const b of billRaw) {
    const record = await prisma.bill.upsert({
      where: { billNumber: b.billNumber },
      update: b,
      create: b,
    });
    billList.push(record);
  }

  // -------------------------------------------------------------------------
  // 10. PAYMENT RECORDS (10 Payments)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Payment Records...");
  const paymentRaw = [
    { receiptNumber: "REC-202608-001", tenantId: tenantList[0].id, propertyId: pgProp.id, rentRecordId: rentList[0].id, amount: new Prisma.Decimal(9000), paymentMethod: "RAZORPAY_UPI" as const, paymentStatus: "SUCCESS" as const, paymentDate: new Date("2026-08-03"), razorpayPaymentId: "pay_demo_001", notes: "Rent payment for Aug 2026 via UPI" },
    { receiptNumber: "REC-202608-002", tenantId: tenantList[1].id, propertyId: pgProp.id, rentRecordId: rentList[1].id, amount: new Prisma.Decimal(5000), paymentMethod: "CASH" as const, paymentStatus: "VERIFIED" as const, paymentDate: new Date("2026-08-04"), notes: "Partial cash payment received by caretaker" },
    { receiptNumber: "REC-202608-003", tenantId: tenantList[4].id, propertyId: house1.id, rentRecordId: rentList[4].id, amount: new Prisma.Decimal(19000), paymentMethod: "BANK_TRANSFER_DD" as const, paymentStatus: "VERIFIED" as const, paymentDate: new Date("2026-08-02"), bankName: "HDFC Bank", bankReferenceNumber: "HDFC9876543", notes: "Direct bank transfer for Green View House" },
    { receiptNumber: "REC-202608-004", tenantId: tenantList[5].id, propertyId: house2.id, rentRecordId: rentList[5].id, amount: new Prisma.Decimal(10000), paymentMethod: "RAZORPAY_UPI" as const, paymentStatus: "SUCCESS" as const, paymentDate: new Date("2026-08-05"), razorpayPaymentId: "pay_demo_004", notes: "Partial rent payment for Sunrise Apartment" },
    { receiptNumber: "REC-202608-005", tenantId: tenantList[0].id, propertyId: pgProp.id, rentRecordId: rentList[6].id, amount: new Prisma.Decimal(8500), paymentMethod: "CASH" as const, paymentStatus: "VERIFIED" as const, paymentDate: new Date("2026-07-04"), notes: "July 2026 rent payment" },
    { receiptNumber: "REC-202608-006", tenantId: tenantList[4].id, propertyId: house1.id, rentRecordId: rentList[7].id, amount: new Prisma.Decimal(18000), paymentMethod: "BANK_TRANSFER_DD" as const, paymentStatus: "VERIFIED" as const, paymentDate: new Date("2026-07-03"), bankName: "ICICI Bank", bankReferenceNumber: "ICIC8765432", notes: "July 2026 house rent payment" },
    { receiptNumber: "REC-202608-007", tenantId: tenantList[0].id, propertyId: pgProp.id, rentRecordId: null, amount: new Prisma.Decimal(1500), paymentMethod: "RAZORPAY_UPI" as const, paymentStatus: "SUCCESS" as const, paymentDate: new Date("2026-08-08"), razorpayPaymentId: "pay_demo_007", notes: "Electricity bill payment" },
    { receiptNumber: "REC-202608-008", tenantId: tenantList[1].id, propertyId: pgProp.id, rentRecordId: null, amount: new Prisma.Decimal(500), paymentMethod: "CASH" as const, paymentStatus: "VERIFIED" as const, paymentDate: new Date("2026-08-08"), notes: "Water bill payment" },
    { receiptNumber: "REC-202608-009", tenantId: tenantList[4].id, propertyId: house1.id, rentRecordId: null, amount: new Prisma.Decimal(1000), paymentMethod: "RAZORPAY_UPI" as const, paymentStatus: "SUCCESS" as const, paymentDate: new Date("2026-08-09"), razorpayPaymentId: "pay_demo_009", notes: "Parking bill payment" },
    { receiptNumber: "REC-202608-010", tenantId: tenantList[0].id, propertyId: pgProp.id, rentRecordId: null, amount: new Prisma.Decimal(4500), paymentMethod: "BANK_TRANSFER_DD" as const, paymentStatus: "VERIFIED" as const, paymentDate: new Date("2026-07-08"), bankName: "SBI", bankReferenceNumber: "SBI7654321", notes: "PG Common electricity bill" },
  ];

  const paymentList = [];
  for (const p of paymentRaw) {
    const record = await prisma.payment.upsert({
      where: { receiptNumber: p.receiptNumber },
      update: p,
      create: p,
    });
    paymentList.push(record);
  }

  // -------------------------------------------------------------------------
  // 11. PAYMENT ALLOCATIONS (10 Allocations)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Payment Allocations...");
  const allocRaw = [
    { paymentId: paymentList[0].id, billId: billList[0].id, amount: new Prisma.Decimal(1500) },
    { paymentId: paymentList[1].id, billId: billList[1].id, amount: new Prisma.Decimal(500) },
    { paymentId: paymentList[2].id, billId: billList[4].id, amount: new Prisma.Decimal(1000) },
    { paymentId: paymentList[3].id, billId: billList[5].id, amount: new Prisma.Decimal(150) },
    { paymentId: paymentList[4].id, billId: billList[0].id, amount: new Prisma.Decimal(1500) },
    { paymentId: paymentList[5].id, billId: billList[6].id, amount: new Prisma.Decimal(2500) },
    { paymentId: paymentList[6].id, billId: billList[0].id, amount: new Prisma.Decimal(1500) },
    { paymentId: paymentList[7].id, billId: billList[1].id, amount: new Prisma.Decimal(500) },
    { paymentId: paymentList[8].id, billId: billList[4].id, amount: new Prisma.Decimal(1000) },
    { paymentId: paymentList[9].id, billId: billList[9].id, amount: new Prisma.Decimal(4500) },
  ];

  for (const al of allocRaw) {
    const existing = await prisma.paymentAllocation.findUnique({
      where: { paymentId_billId: { paymentId: al.paymentId, billId: al.billId } },
    });
    if (!existing) {
      await prisma.paymentAllocation.create({ data: al });
    }
  }

  // -------------------------------------------------------------------------
  // 12. RAZORPAY ORDERS (`PaymentLink` model) (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Razorpay Order PaymentLinks...");
  const orderRaw = [
    { tenantId: tenantList[0].id, rentRecordId: rentList[0].id, amount: new Prisma.Decimal(9000), razorpayOrderId: "order_demo_001", razorpayLinkId: "plink_demo_001", shortUrl: "https://rzp.io/l/demo001", status: "PAID", paidAt: new Date("2026-08-03") },
    { tenantId: tenantList[1].id, rentRecordId: rentList[1].id, amount: new Prisma.Decimal(5000), razorpayOrderId: "order_demo_002", razorpayLinkId: "plink_demo_002", shortUrl: "https://rzp.io/l/demo002", status: "PENDING", expiresAt: new Date("2026-08-20") },
    { tenantId: tenantList[2].id, rentRecordId: rentList[2].id, amount: new Prisma.Decimal(10000), razorpayOrderId: "order_demo_003", razorpayLinkId: "plink_demo_003", shortUrl: "https://rzp.io/l/demo003", status: "PENDING", expiresAt: new Date("2026-08-20") },
    { tenantId: tenantList[3].id, rentRecordId: rentList[3].id, amount: new Prisma.Decimal(11000), razorpayOrderId: "order_demo_004", razorpayLinkId: "plink_demo_004", shortUrl: "https://rzp.io/l/demo004", status: "PENDING", expiresAt: new Date("2026-08-20") },
    { tenantId: tenantList[4].id, rentRecordId: rentList[4].id, amount: new Prisma.Decimal(19000), razorpayOrderId: "order_demo_005", razorpayLinkId: "plink_demo_005", shortUrl: "https://rzp.io/l/demo005", status: "PAID", paidAt: new Date("2026-08-02") },
    { tenantId: tenantList[5].id, rentRecordId: rentList[5].id, amount: new Prisma.Decimal(10000), razorpayOrderId: "order_demo_006", razorpayLinkId: "plink_demo_006", shortUrl: "https://rzp.io/l/demo006", status: "PAID", paidAt: new Date("2026-08-05") },
    { tenantId: tenantList[6].id, rentRecordId: rentList[6].id, amount: new Prisma.Decimal(8500), razorpayOrderId: "order_demo_007", razorpayLinkId: "plink_demo_007", shortUrl: "https://rzp.io/l/demo007", status: "PAID", paidAt: new Date("2026-07-04") },
    { tenantId: tenantList[7].id, rentRecordId: rentList[7].id, amount: new Prisma.Decimal(18000), razorpayOrderId: "order_demo_008", razorpayLinkId: "plink_demo_008", shortUrl: "https://rzp.io/l/demo008", status: "PAID", paidAt: new Date("2026-07-03") },
    { tenantId: tenantList[8].id, rentRecordId: rentList[8].id, amount: new Prisma.Decimal(10000), razorpayOrderId: "order_demo_009", razorpayLinkId: "plink_demo_009", shortUrl: "https://rzp.io/l/demo009", status: "EXPIRED", expiresAt: new Date("2026-07-01") },
    { tenantId: tenantList[9].id, rentRecordId: rentList[9].id, amount: new Prisma.Decimal(26000), razorpayOrderId: "order_demo_010", razorpayLinkId: "plink_demo_010", shortUrl: "https://rzp.io/l/demo010", status: "EXPIRED", expiresAt: new Date("2026-06-01") },
  ];

  for (const o of orderRaw) {
    await prisma.paymentLink.upsert({
      where: { razorpayOrderId: o.razorpayOrderId },
      update: o,
      create: o,
    });
  }

  // -------------------------------------------------------------------------
  // 13. AGREEMENTS & E-SIGNATURES (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Agreements...");
  const agreementRaw = [
    { agreementNumber: "AGR-2026-001", tenantId: tenantList[0].id, propertyId: pgProp.id, startDate: new Date("2026-08-01"), endDate: new Date("2027-07-31"), rent: new Prisma.Decimal(8500), advance: new Prisma.Decimal(17000), deposit: new Prisma.Decimal(25000), status: "DRAFT" as const },
    { agreementNumber: "AGR-2026-002", tenantId: tenantList[1].id, propertyId: pgProp.id, startDate: new Date("2026-08-01"), endDate: new Date("2027-07-31"), rent: new Prisma.Decimal(8500), advance: new Prisma.Decimal(17000), deposit: new Prisma.Decimal(25000), status: "DRAFT" as const },
    { agreementNumber: "AGR-2026-003", tenantId: tenantList[2].id, propertyId: pgProp.id, startDate: new Date("2026-08-01"), endDate: new Date("2027-07-31"), rent: new Prisma.Decimal(9000), advance: new Prisma.Decimal(18000), deposit: new Prisma.Decimal(25000), status: "SENT" as const, token: "token_demo_003", sentAt: new Date("2026-08-01") },
    { agreementNumber: "AGR-2026-004", tenantId: tenantList[3].id, propertyId: pgProp.id, startDate: new Date("2026-08-01"), endDate: new Date("2027-07-31"), rent: new Prisma.Decimal(9000), advance: new Prisma.Decimal(18000), deposit: new Prisma.Decimal(25000), status: "VIEWED" as const, token: "token_demo_004", sentAt: new Date("2026-08-01"), viewedAt: new Date("2026-08-02") },
    { agreementNumber: "AGR-2026-005", tenantId: tenantList[4].id, propertyId: house1.id, startDate: new Date("2026-05-15"), endDate: new Date("2027-05-14"), rent: new Prisma.Decimal(18000), advance: new Prisma.Decimal(36000), deposit: new Prisma.Decimal(50000), status: "SIGNED" as const, token: "token_demo_005", sentAt: new Date("2026-05-15"), viewedAt: new Date("2026-05-15"), signedAt: new Date("2026-05-16"), signatureName: "Praveen Kumar", signedIp: "192.168.1.10" },
    { agreementNumber: "AGR-2026-006", tenantId: tenantList[5].id, propertyId: house2.id, startDate: new Date("2026-06-01"), endDate: new Date("2027-05-31"), rent: new Prisma.Decimal(20000), advance: new Prisma.Decimal(40000), deposit: new Prisma.Decimal(60000), status: "SIGNED" as const, token: "token_demo_006", sentAt: new Date("2026-06-01"), viewedAt: new Date("2026-06-01"), signedAt: new Date("2026-06-02"), signatureName: "Vignesh S", signedIp: "192.168.1.10" },
    { agreementNumber: "AGR-2026-007", tenantId: tenantList[0].id, propertyId: pgProp.id, startDate: new Date("2026-01-15"), endDate: new Date("2027-01-14"), rent: new Prisma.Decimal(8500), advance: new Prisma.Decimal(17000), deposit: new Prisma.Decimal(25000), status: "ACTIVE" as const, token: "token_demo_007", sentAt: new Date("2026-01-15"), signedAt: new Date("2026-01-15"), signatureName: "Arun Kumar", signedIp: "192.168.1.10" },
    { agreementNumber: "AGR-2026-008", tenantId: tenantList[1].id, propertyId: pgProp.id, startDate: new Date("2026-02-01"), endDate: new Date("2027-01-31"), rent: new Prisma.Decimal(8500), advance: new Prisma.Decimal(17000), deposit: new Prisma.Decimal(25000), status: "ACTIVE" as const, token: "token_demo_008", sentAt: new Date("2026-02-01"), signedAt: new Date("2026-02-01"), signatureName: "Ramesh Kumar", signedIp: "192.168.1.10" },
    { agreementNumber: "AGR-2026-009", tenantId: tenantList[8].id, propertyId: pgProp.id, startDate: new Date("2025-06-01"), endDate: new Date("2026-05-31"), rent: new Prisma.Decimal(9000), advance: new Prisma.Decimal(18000), deposit: new Prisma.Decimal(25000), status: "EXPIRED" as const, token: "token_demo_009", sentAt: new Date("2025-06-01"), signedAt: new Date("2025-06-01"), signatureName: "Naveen Kumar", signedIp: "192.168.1.10" },
    { agreementNumber: "AGR-2026-010", tenantId: tenantList[9].id, propertyId: house3.id, startDate: new Date("2025-05-01"), endDate: new Date("2026-04-30"), rent: new Prisma.Decimal(25000), advance: new Prisma.Decimal(50000), deposit: new Prisma.Decimal(75000), status: "TERMINATED" as const, token: "token_demo_010", sentAt: new Date("2025-05-01"), signedAt: new Date("2025-05-01"), signatureName: "Ajay Krishnan", signedIp: "192.168.1.10", cancellationReason: "Early lease termination by tenant request" },
  ];

  for (const ag of agreementRaw) {
    await prisma.agreement.upsert({
      where: { agreementNumber: ag.agreementNumber },
      update: ag,
      create: ag,
    });
  }

  // -------------------------------------------------------------------------
  // 14. OPERATING EXPENSES (10 Records)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Operating Expenses...");
  const expRaw = [
    { propertyId: pgProp.id, category: "REPAIRS", description: "Plumbing repair in Room 101 bathroom", amount: new Prisma.Decimal(1450), expenseDate: new Date("2026-08-02"), vendorId: vendorList[1].id, staffId: staffList[0].id },
    { propertyId: house1.id, category: "REPAIRS", description: "Electrical repair and circuit breaker fixing", amount: new Prisma.Decimal(850), expenseDate: new Date("2026-08-03"), vendorId: vendorList[0].id, staffId: staffList[1].id },
    { propertyId: pgProp.id, category: "CLEANING", description: "Water tank cleaning and chlorination", amount: new Prisma.Decimal(2500), expenseDate: new Date("2026-08-04"), vendorId: vendorList[4].id, staffId: staffList[4].id },
    { propertyId: pgProp.id, category: "STAFF", description: "Monthly housekeeping salary", amount: new Prisma.Decimal(8000), expenseDate: new Date("2026-08-01"), staffId: staffList[4].id },
    { propertyId: house2.id, category: "UTILITIES", description: "Internet broadband monthly bill", amount: new Prisma.Decimal(1499), expenseDate: new Date("2026-08-05"), vendorId: vendorList[3].id, staffId: staffList[2].id },
    { propertyId: house3.id, category: "REPAIRS", description: "AC maintenance and gas refill", amount: new Prisma.Decimal(2200), expenseDate: new Date("2026-08-06"), vendorId: vendorList[5].id, staffId: staffList[3].id },
    { propertyId: pgProp.id, category: "STAFF", description: "Security service charges", amount: new Prisma.Decimal(6500), expenseDate: new Date("2026-08-01"), staffId: staffList[6].id },
    { propertyId: house1.id, category: "REPAIRS", description: "Exterior wall touch-up painting", amount: new Prisma.Decimal(3500), expenseDate: new Date("2026-08-07"), vendorId: vendorList[6].id, staffId: staffList[1].id },
    { propertyId: house3.id, category: "VENDOR", description: "Water pump motor service & bearing replacement", amount: new Prisma.Decimal(1800), expenseDate: new Date("2026-08-08"), vendorId: vendorList[7].id, staffId: staffList[3].id },
    { propertyId: pgProp.id, category: "CLEANING", description: "Disinfectant and cleaning supplies purchase", amount: new Prisma.Decimal(1200), expenseDate: new Date("2026-08-09"), staffId: staffList[5].id },
  ];

  await prisma.expense.deleteMany({
    where: {
      description: {
        in: expRaw.map((e) => e.description),
      },
    },
  });

  for (const ex of expRaw) {
    await prisma.expense.create({ data: ex });
  }

  // -------------------------------------------------------------------------
  // 15. MAINTENANCE REQUESTS (10 Tickets)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Maintenance Tickets...");
  const maintRaw = [
    { propertyId: pgProp.id, roomId: pgProp.rooms[0]?.id || null, tenantId: tenantList[0].id, category: "PLUMBING", priority: "HIGH", status: "RESOLVED" as const, description: "Plumbing leak under Room 101 sink", estimatedCost: new Prisma.Decimal(1500), actualCost: new Prisma.Decimal(1450), assignedStaffId: staffList[0].id, assignedVendorId: vendorList[1].id, resolvedAt: new Date("2026-08-02") },
    { propertyId: house1.id, tenantId: tenantList[4].id, category: "ELECTRICAL", priority: "MEDIUM", status: "RESOLVED" as const, description: "Main distribution board breaker trip", estimatedCost: new Prisma.Decimal(1000), actualCost: new Prisma.Decimal(850), assignedStaffId: staffList[1].id, assignedVendorId: vendorList[0].id, resolvedAt: new Date("2026-08-03") },
    { propertyId: house3.id, tenantId: tenantList[9].id, category: "AC", priority: "HIGH", status: "IN_PROGRESS" as const, description: "Master bedroom AC not cooling properly", estimatedCost: new Prisma.Decimal(2500), assignedStaffId: staffList[3].id, assignedVendorId: vendorList[5].id },
    { propertyId: pgProp.id, roomId: pgProp.rooms[1]?.id || null, tenantId: tenantList[2].id, category: "CLEANING", priority: "LOW", status: "RESOLVED" as const, description: "Room 102 deep cleaning request", estimatedCost: new Prisma.Decimal(2500), actualCost: new Prisma.Decimal(2500), assignedStaffId: staffList[4].id, assignedVendorId: vendorList[4].id, resolvedAt: new Date("2026-08-04") },
    { propertyId: house1.id, tenantId: tenantList[4].id, category: "PAINTING", priority: "LOW", status: "OPEN" as const, description: "Exterior wall touch-up painting", estimatedCost: new Prisma.Decimal(3500), assignedStaffId: staffList[1].id, assignedVendorId: vendorList[6].id },
    { propertyId: pgProp.id, roomId: pgProp.rooms[2]?.id || null, tenantId: tenantList[6].id, category: "CARPENTRY", priority: "MEDIUM", status: "IN_PROGRESS" as const, description: "Door lock cylinder replacement", estimatedCost: new Prisma.Decimal(1200), assignedStaffId: staffList[0].id, assignedVendorId: vendorList[2].id },
    { propertyId: house3.id, tenantId: tenantList[9].id, category: "WATER", priority: "HIGH", status: "RESOLVED" as const, description: "Water pump motor noise and bearing replacement", estimatedCost: new Prisma.Decimal(2000), actualCost: new Prisma.Decimal(1800), assignedStaffId: staffList[3].id, assignedVendorId: vendorList[7].id, resolvedAt: new Date("2026-08-08") },
    { propertyId: pgProp.id, roomId: pgProp.rooms[0]?.id || null, tenantId: tenantList[1].id, category: "PLUMBING", priority: "LOW", status: "OPEN" as const, description: "Bathroom tap slow water flow", estimatedCost: new Prisma.Decimal(600), assignedStaffId: staffList[0].id, assignedVendorId: vendorList[1].id },
    { propertyId: house2.id, tenantId: tenantList[5].id, category: "GENERAL", priority: "MEDIUM", status: "RESOLVED" as const, description: "Wi-Fi router replacement and setup", estimatedCost: new Prisma.Decimal(1500), actualCost: new Prisma.Decimal(1499), assignedStaffId: staffList[2].id, assignedVendorId: vendorList[3].id, resolvedAt: new Date("2026-08-05") },
    { propertyId: pgProp.id, tenantId: tenantList[3].id, category: "CARPENTRY", priority: "LOW", status: "OPEN" as const, description: "PG entrance gate latch repair", estimatedCost: new Prisma.Decimal(900), assignedStaffId: staffList[6].id, assignedVendorId: vendorList[2].id },
  ];

  await prisma.maintenanceRequest.deleteMany({
    where: {
      description: { in: maintRaw.map((m) => m.description) },
    },
  });

  for (const m of maintRaw) {
    await prisma.maintenanceRequest.create({ data: m });
  }

  // -------------------------------------------------------------------------
  // 16. PG GUEST REGISTER (10 Guests)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 PG Guest Logs...");
  const guestRaw = [
    { tenantId: tenantList[0].id, guestName: "Sundaram Kumar", guestPhone: "9876543291", relation: "Parent", entryDate: new Date("2026-08-10T09:00:00Z"), exitDate: new Date("2026-08-12T18:00:00Z"), notes: "Parent visited for weekend" },
    { tenantId: tenantList[1].id, guestName: "Vijay Kumar", guestPhone: "9876543292", relation: "Friend", entryDate: new Date("2026-08-11T14:00:00Z"), exitDate: new Date("2026-08-11T20:00:00Z"), notes: "College friend visit" },
    { tenantId: tenantList[2].id, guestName: "Anitha M", guestPhone: "9876543293", relation: "Sibling", entryDate: new Date("2026-08-13T10:00:00Z"), exitDate: new Date("2026-08-13T16:00:00Z"), notes: "Sister visit" },
    { tenantId: tenantList[3].id, guestName: "Priya Raj", guestPhone: "9876543294", relation: "Spouse", entryDate: new Date("2026-08-05T11:00:00Z"), exitDate: new Date("2026-08-08T17:00:00Z"), notes: "Spouse stayed over weekend" },
    { tenantId: tenantList[5].id, guestName: "Suresh S", guestPhone: "9876543296", relation: "Parent", entryDate: new Date("2026-08-01T08:00:00Z"), exitDate: new Date("2026-08-03T19:00:00Z"), notes: "Father stay" },
    { tenantId: tenantList[4].id, guestName: "Karthik M", guestPhone: "9876543288", relation: "Friend", entryDate: new Date("2026-08-14T10:00:00Z"), exitDate: null, notes: "Current active visitor" },
    { tenantId: tenantList[6].id, guestName: "Rajesh R", guestPhone: "9876543287", relation: "Colleague", entryDate: new Date("2026-08-14T11:30:00Z"), exitDate: null, notes: "Current active visitor" },
    { tenantId: tenantList[7].id, guestName: "Meena K", guestPhone: "9876543286", relation: "Relative", entryDate: new Date("2026-08-09T15:00:00Z"), exitDate: new Date("2026-08-10T11:00:00Z"), notes: "Relative visit" },
    { tenantId: tenantList[8].id, guestName: "Prakash N", guestPhone: "9876543285", relation: "Sibling", entryDate: new Date("2026-08-04T12:00:00Z"), exitDate: new Date("2026-08-04T18:00:00Z"), notes: "Brother day visit" },
    { tenantId: tenantList[9].id, guestName: "Gopinath A", guestPhone: "9876543284", relation: "Friend", entryDate: new Date("2026-08-02T13:00:00Z"), exitDate: new Date("2026-08-02T17:00:00Z"), notes: "Friend day visit" },
  ];

  await prisma.guestLog.deleteMany({ where: { tenantId: { in: tenantList.map((t) => t.id) } } });
  for (const g of guestRaw) {
    await prisma.guestLog.create({ data: g });
  }

  // -------------------------------------------------------------------------
  // 17. TENANT LEAVE APPLICATIONS (10 Applications)
  // -------------------------------------------------------------------------
  logger.info("Seeding 10 Tenant Leave Applications...");
  const leaveRaw = [
    { tenantId: tenantList[0].id, startDate: new Date("2026-08-20"), endDate: new Date("2026-08-25"), reason: "Family function travel", status: "APPROVED" as const, notes: "Approved by manager" },
    { tenantId: tenantList[1].id, startDate: new Date("2026-08-22"), endDate: new Date("2026-08-24"), reason: "Personal work at hometown", status: "APPROVED" as const, notes: "Approved by manager" },
    { tenantId: tenantList[2].id, startDate: new Date("2026-08-28"), endDate: new Date("2026-09-02"), reason: "Festival travel", status: "PENDING" as const, notes: "Pending review" },
    { tenantId: tenantList[3].id, startDate: new Date("2026-08-15"), endDate: new Date("2026-08-18"), reason: "Medical appointment", status: "APPROVED" as const, notes: "Approved with medical cert" },
    { tenantId: tenantList[4].id, startDate: new Date("2026-09-01"), endDate: new Date("2026-09-07"), reason: "Annual leave vacation", status: "PENDING" as const, notes: "Pending review" },
    { tenantId: tenantList[5].id, startDate: new Date("2026-08-30"), endDate: new Date("2026-09-03"), reason: "College convocation visit", status: "APPROVED" as const, notes: "Approved" },
    { tenantId: tenantList[6].id, startDate: new Date("2026-08-18"), endDate: new Date("2026-08-20"), reason: "Emergency home visit", status: "PENDING" as const, notes: "Under verification" },
    { tenantId: tenantList[7].id, startDate: new Date("2026-08-10"), endDate: new Date("2026-08-12"), reason: "Weekend travel", status: "REJECTED" as const, notes: "Short notice application" },
    { tenantId: tenantList[8].id, startDate: new Date("2026-05-20"), endDate: new Date("2026-05-25"), reason: "Hometown visit", status: "REJECTED" as const, notes: "Conflict with notice period" },
    { tenantId: tenantList[9].id, startDate: new Date("2026-04-10"), endDate: new Date("2026-04-15"), reason: "Personal work", status: "REJECTED" as const, notes: "Documentation incomplete" },
  ];

  await prisma.tenantLeave.deleteMany({ where: { tenantId: { in: tenantList.map((t) => t.id) } } });
  for (const l of leaveRaw) {
    await prisma.tenantLeave.create({ data: l });
  }

  // -------------------------------------------------------------------------
  // FINAL VERIFICATION SUMMARY
  // -------------------------------------------------------------------------
  const [
    tenantCount,
    familyCount,
    kycCount,
    transferCount,
    rentCount,
    adjCount,
    billCount,
    paymentCount,
    allocCount,
    orderCount,
    agreementCount,
    expenseCount,
    maintCount,
    staffCount,
    vendorCount,
    guestCount,
    leaveCount,
  ] = await Promise.all([
    prisma.tenant.count(),
    prisma.familyMember.count(),
    prisma.tenantDocument.count(),
    prisma.tenantTransferHistory.count(),
    prisma.rentRecord.count(),
    prisma.rentAdjustment.count(),
    prisma.bill.count(),
    prisma.payment.count(),
    prisma.paymentAllocation.count(),
    prisma.paymentLink.count(),
    prisma.agreement.count(),
    prisma.expense.count(),
    prisma.maintenanceRequest.count(),
    prisma.staff.count(),
    prisma.vendor.count(),
    prisma.guestLog.count(),
    prisma.tenantLeave.count(),
  ]);

  console.log("=================================================");
  console.log("DEMO SEED COMPLETED SUCCESSFULLY!");
  console.log(`- Tenants:          ${tenantCount}`);
  console.log(`- Family Members:   ${familyCount}`);
  console.log(`- KYC Documents:    ${kycCount}`);
  console.log(`- Transfers:        ${transferCount}`);
  console.log(`- Rent Records:     ${rentCount}`);
  console.log(`- Adjustments:      ${adjCount}`);
  console.log(`- Bills:            ${billCount}`);
  console.log(`- Payments:         ${paymentCount}`);
  console.log(`- Allocations:      ${allocCount}`);
  console.log(`- Razorpay Orders:  ${orderCount}`);
  console.log(`- Agreements:       ${agreementCount}`);
  console.log(`- Expenses:         ${expenseCount}`);
  console.log(`- Maintenance:      ${maintCount}`);
  console.log(`- Staff Members:    ${staffCount}`);
  console.log(`- Vendors:          ${vendorCount}`);
  console.log(`- Guest Logs:       ${guestCount}`);
  console.log(`- Tenant Leaves:    ${leaveCount}`);
  console.log("=================================================");
}

main()
  .catch((e) => {
    logger.error(String(e));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
