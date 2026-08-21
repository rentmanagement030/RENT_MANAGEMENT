import { prisma } from "./config/prisma";
import { TaxService } from "./services/tax.service";
import { HomeService } from "./services/home.service";
import { calculateNextDueDate, calculateNextTaxPeriod, deriveTaxStatus } from "./utils/taxCalculator";

async function runComprehensiveVerificationSuite() {
  console.log("=================================================");
  console.log("  C2D RENTALS — FULL ASYMMETRIC FLOOR & HOME SUITE");
  console.log("=================================================\n");

  let testPassed = 0;
  let testFailed = 0;

  function assert(condition: boolean, title: string) {
    if (condition) {
      console.log(`[PASS] ${title}`);
      testPassed++;
    } else {
      console.error(`[FAIL] ${title}`);
      testFailed++;
    }
  }

  try {
    let adminUser = await prisma.user.findFirst();
    if (!adminUser) {
      adminUser = await prisma.user.create({
        data: {
          email: "test.admin@c2d.com",
          name: "Test Admin",
          phone: "9999999999",
          passwordHash: "dummyhash",
        },
      });
    }
    const userId = adminUser.id;

    // -------------------------------------------------------------------------
    // TEST 1: ASYMMETRIC VILLA STRUCTURES (1+3+2 Homes on 3 Floors)
    // -------------------------------------------------------------------------
    console.log("--- TEST 1: Asymmetric Villa Structures (3 Floors: 1 + 3 + 2 Homes) ---");
    const greenVilla = await prisma.property.create({
      data: {
        type: "VILLA",
        name: "Green View Villa Asymmetric",
        address: "78 East Coast Road",
        city: "Chennai",
        area: "ECR",
        rent: 70000,
        status: "AVAILABLE",
        ebConnectionType: "SHARED_PROPERTY",
        ebNumber: "EB-GREEN-VILLA-SHARED",
      },
    });

    // Ground Floor: 1 Home (G-01)
    const g01 = await HomeService.createHome({
      propertyId: greenVilla.id,
      floor: "Ground Floor",
      homeNumber: "G-01",
      homeType: "3 BHK",
      rent: 18000,
      advance: 36000,
      deposit: 50000,
      dueDay: 5,
      latePenalty: 50,
      status: "AVAILABLE",
      ebConnectionType: "INDIVIDUAL",
      ebNumber: "EB-CHN-100234",
      ebMeterNumber: "MTR-00123",
    }, userId);

    // First Floor: 3 Homes (F-01, F-02, F-03)
    const f01 = await HomeService.createHome({
      propertyId: greenVilla.id,
      floor: "First Floor",
      homeNumber: "F-01",
      homeType: "3 BHK",
      rent: 20000,
      advance: 40000,
      deposit: 60000,
      dueDay: 5,
      latePenalty: 50,
      status: "AVAILABLE",
    }, userId);

    const f02 = await HomeService.createHome({
      propertyId: greenVilla.id,
      floor: "First Floor",
      homeNumber: "F-02",
      homeType: "2 BHK",
      rent: 15000,
      advance: 30000,
      deposit: 45000,
      dueDay: 5,
      latePenalty: 50,
      status: "AVAILABLE",
    }, userId);

    const f03 = await HomeService.createHome({
      propertyId: greenVilla.id,
      floor: "First Floor",
      homeNumber: "F-03",
      homeType: "1 BHK",
      rent: 12000,
      advance: 24000,
      deposit: 35000,
      dueDay: 5,
      latePenalty: 50,
      status: "AVAILABLE",
    }, userId);

    // Second Floor: 2 Homes (S-01, S-02)
    const s01 = await HomeService.createHome({
      propertyId: greenVilla.id,
      floor: "Second Floor",
      homeNumber: "S-01",
      homeType: "2 BHK",
      rent: 16000,
      advance: 32000,
      deposit: 48000,
      dueDay: 5,
      latePenalty: 50,
      status: "AVAILABLE",
    }, userId);

    const s02 = await HomeService.createHome({
      propertyId: greenVilla.id,
      floor: "Second Floor",
      homeNumber: "S-02",
      homeType: "Penthouse",
      rent: 25000,
      advance: 50000,
      deposit: 75000,
      dueDay: 5,
      latePenalty: 50,
      status: "AVAILABLE",
    }, userId);

    const floorGroup = await HomeService.listHomesByProperty(greenVilla.id);
    assert(floorGroup.totalHomes === 6, "Created 6 independent PropertyHome records across 3 floors");
    assert(floorGroup.floors.length === 3, "Grouped into 3 distinct floors (Ground, First, Second Floor)");

    const groundFloor = floorGroup.floors.find((f) => f.floor.toLowerCase().includes("ground"));
    const firstFloor = floorGroup.floors.find((f) => f.floor.toLowerCase().includes("first"));
    const secondFloor = floorGroup.floors.find((f) => f.floor.toLowerCase().includes("second"));

    assert(
      groundFloor?.homes.length === 1 &&
        firstFloor?.homes.length === 3 &&
        secondFloor?.homes.length === 2,
      "Asymmetric breakdown verified: Ground (1 Home), First (3 Homes), Second (2 Homes)"
    );

    // -------------------------------------------------------------------------
    // TEST 2: DUPLICATE HOME NUMBER REJECTION
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 2: Duplicate Home Number Rejection ---");
    let dupBlocked = false;
    try {
      await HomeService.createHome({
        propertyId: greenVilla.id,
        floor: "Ground Floor",
        homeNumber: "G-01", // Duplicate
        homeType: "2 BHK",
        rent: 18000,
        advance: 36000,
        deposit: 50000,
        dueDay: 5,
        latePenalty: 50,
        status: "AVAILABLE",
      }, userId);
    } catch (err: any) {
      dupBlocked = true;
    }
    assert(dupBlocked === true, "Attempt to add duplicate Home Number 'G-01' correctly rejected");

    // -------------------------------------------------------------------------
    // TEST 3: HOME FINANCIAL ISOLATION
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 3: Home Financial Isolation ---");
    await HomeService.updateHome(g01.id, { rent: 22000 }, userId);
    const f01Recheck = await HomeService.getHomeById(f01.id);
    assert(f01Recheck.rent === 20000, "Updating G-01 rent to ₹22,000 does NOT affect F-01 (remains ₹20,000)");

    // -------------------------------------------------------------------------
    // TEST 4: DELETING A HOME
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 4: Deleting a Home ---");
    await HomeService.deleteHome(s02.id, userId);
    const postDeleteList = await HomeService.listHomesByProperty(greenVilla.id);
    assert(postDeleteList.totalHomes === 5, "Home S-02 deleted/archived cleanly (5 active homes remain)");

    // -------------------------------------------------------------------------
    // TEST 5: INDIVIDUAL VS SHARED EB
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 5: Individual vs Shared EB Connections ---");
    const g01Check = await HomeService.getHomeById(g01.id);
    const f01Check = await HomeService.getHomeById(f01.id);
    assert(g01Check.ebConnectionType === "INDIVIDUAL" && g01Check.ebNumber === "EB-CHN-100234", "G-01 displays individual meter EB-CHN-100234");
    assert(f01Check.ebNumber === null || f01Check.ebNumber === undefined, "F-01 does NOT inherit G-01's individual meter");

    // -------------------------------------------------------------------------
    // TEST 6: WATER TAX & ADVANCEMENT
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 6: Bi-Monthly Water Tax Calculation ---");
    const waterTax = await TaxService.createTaxRecord({
      taxType: "WATER_TAX",
      taxOwnership: "PROPERTY",
      propertyId: greenVilla.id,
      consumerNumber: "WT-ECR-9911",
      frequency: "BI_MONTHLY",
      annualTaxAmount: 2000,
      currentTaxPeriod: "2026-Q1",
      nextDueDate: "2026-08-17",
    }, userId);

    const waterPayResult = await TaxService.recordTaxPayment({
      taxRecordId: waterTax.id,
      amount: 2000,
      paymentDate: "2026-08-17",
      paymentMethod: "UPI",
    }, userId);

    assert(waterPayResult.isFullyPaid === true, "Water Tax marked PAID after full ₹2,000 settlement");
    const nextDueStr = new Date(waterPayResult.nextDueDate).toISOString().split("T")[0];
    assert(nextDueStr === "2026-10-17", `Next due date advanced by exactly 2 months (Expected: 2026-10-17, Actual: ${nextDueStr})`);

    // -------------------------------------------------------------------------
    // TEST 7: PARTIAL + FINAL PAYMENT & NON-DUPLICATION ACCOUNTING
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 7: Partial + Final Payment & Non-Duplication Accounting ---");
    const propTax = await TaxService.createTaxRecord({
      taxType: "PROPERTY_TAX",
      taxOwnership: "PROPERTY",
      propertyId: greenVilla.id,
      assessmentNumber: "PT-ECR-8877",
      frequency: "ANNUAL",
      annualTaxAmount: 18000,
      currentTaxPeriod: "2026-27",
      nextDueDate: "2026-09-01",
    }, userId);

    const pay1 = await TaxService.recordTaxPayment({
      taxRecordId: propTax.id,
      amount: 10000,
      paymentDate: "2026-08-17",
      paymentMethod: "BANK_TRANSFER",
    }, userId);

    assert(pay1.isFullyPaid === false, "Payment 1 (₹10,000/₹18,000): isFullyPaid is false");
    assert(Number(pay1.updatedTaxRecord.outstandingAmount) === 8000, "Outstanding balance is ₹8,000");

    const pay2 = await TaxService.recordTaxPayment({
      taxRecordId: propTax.id,
      amount: 8000,
      paymentDate: "2026-08-20",
      paymentMethod: "UPI",
    }, userId);

    assert(pay2.isFullyPaid === true, "Payment 2 (₹8,000/₹8,000): isFullyPaid is true");
    assert(pay2.updatedTaxRecord.currentTaxPeriod === "2027-28", "Period advanced to 2027-28");

    const pnlExpenses = await prisma.expense.findMany({
      where: { propertyId: greenVilla.id, category: "PROPERTY_TAX" },
      orderBy: { expenseDate: "asc" },
    });
    assert(pnlExpenses.length === 2, "Exactly 2 Expense records created for 2 payments without double-counting");

    // -------------------------------------------------------------------------
    // TEST 8: PG & HOUSE BACKWARD COMPATIBILITY
    // -------------------------------------------------------------------------
    console.log("\n--- TEST 8: PG & House Backward Compatibility ---");
    const testPgProp = await prisma.property.create({
      data: {
        type: "PG",
        name: "Test Backward Comp PG",
        address: "100 PG Road",
        city: "Chennai",
        rent: 9000,
        status: "AVAILABLE",
      },
    });

    const testRoom = await prisma.pgRoom.create({
      data: {
        propertyId: testPgProp.id,
        roomNumber: "201",
        capacity: 2,
        rent: 9000,
      },
    });

    const testBed = await prisma.pgBed.create({
      data: {
        roomId: testRoom.id,
        bedNumber: "201-A",
        status: "AVAILABLE",
      },
    });

    assert(testBed.bedNumber === "201-A" && testRoom.roomNumber === "201", "PG Room & Bed hierarchy fully functional");

    // Clean up test data
    console.log("\n--- Cleaning up test data ---");
    await prisma.taxPaymentRecord.deleteMany({ where: { propertyId: greenVilla.id } });
    await prisma.taxRecord.deleteMany({ where: { propertyId: greenVilla.id } });
    await prisma.expense.deleteMany({ where: { propertyId: greenVilla.id } });
    await prisma.propertyHome.deleteMany({ where: { propertyId: greenVilla.id } });
    await prisma.property.delete({ where: { id: greenVilla.id } });
    await prisma.pgBed.delete({ where: { id: testBed.id } });
    await prisma.pgRoom.delete({ where: { id: testRoom.id } });
    await prisma.property.delete({ where: { id: testPgProp.id } });

    console.log("\n=================================================");
    console.log(`  COMPREHENSIVE SUITE: ${testPassed} PASSED, ${testFailed} FAILED`);
    console.log("=================================================");
  } catch (err) {
    console.error("Test Suite Execution Error:", err);
  } finally {
    await prisma.$disconnect();
  }
}

runComprehensiveVerificationSuite();
