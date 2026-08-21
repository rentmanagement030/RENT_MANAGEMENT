import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  const dataPath = path.join(__dirname, 'test-data.json');
  const testData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // 1. Properties
  console.log('Inserting Properties...');
  for (const p of testData.properties) {
    let type = p.propertyType;
    if (type === 'MULTI_HOME') type = 'VILLA';

    const prop = await prisma.property.create({
      data: {
        type: type,
        name: p.propertyName,
        number: p.buildingDoorNumber,
        address: p.streetAddress,
        city: p.city,
        area: p.areaLocality,
        contactPhone: p.primaryContactPhone,
        ebMeterNumber: p.ebMeterNumber,
        rent: p.rent,
        deposit: p.securityDeposit,
        maxCapacity: p.maxCapacity,
        status: p.initialStatus,
        latePenalty: p.overduePenaltyPerDay,
        dueDay: p.rentDueDay,
      }
    });

    // 2. Floors & Rooms/Homes
    for (const floor of p.floors) {
      for (const home of floor.homes) {
        if (type === 'PG') {
          // Room
          const room = await prisma.pgRoom.create({
            data: {
              propertyId: prop.id,
              floor: floor.name,
              roomNumber: home.name,
              capacity: home.capacity,
              rent: home.rent,
              deposit: home.securityDeposit,
            }
          });
          // Beds
          for (let i = 0; i < home.capacity; i++) {
            const bedNumber = 'Bed ' + String.fromCharCode(65 + i); // Bed A, Bed B
            await prisma.pgBed.create({
              data: {
                roomId: room.id,
                bedNumber,
                rent: home.rent,
                deposit: home.securityDeposit
              }
            });
          }
        } else {
          // Home
          await prisma.propertyHome.create({
            data: {
              propertyId: prop.id,
              floor: floor.name,
              homeNumber: home.name,
              homeType: home.unitType || '2 BHK',
              rent: home.rent,
              deposit: home.securityDeposit
            }
          });
        }
      }
    }
  }

  // Caching props for lookups
  const props = await prisma.property.findMany();
  const rooms = await prisma.pgRoom.findMany({ include: { beds: true, property: true } });
  const homes = await prisma.propertyHome.findMany({ include: { property: true } });
  
  function getProp(name: string) { return props.find(p => p.name === name); }
  
  function resolveUnit(unitStr: string) {
    const parts = unitStr.split(' / ');
    if (parts.length === 3) {
      const pName = parts[0];
      const rName = parts[1];
      const bName = parts[2];
      const room = rooms.find(r => r.property.name === pName && r.roomNumber === rName);
      if (!room) return {};
      const bed = room.beds.find(b => b.bedNumber === bName);
      return { roomId: room.id, bedId: bed?.id };
    } else if (parts.length === 2) {
      const pName = parts[0];
      const hName = parts[1];
      const home = homes.find(h => h.property.name === pName && h.homeNumber === hName);
      return { homeId: home?.id };
    }
    return {}; 
  }

  // 3. Staff
  console.log('Inserting Staff...');
  for (const s of testData.staff) {
    await prisma.staff.create({
      data: {
        name: s.fullName,
        phone: s.phone,
        role: s.role,
        properties: {
          connect: s.properties.map((pName: string) => ({ id: getProp(pName)?.id }))
        }
      }
    });
  }

  // 4. Vendors
  console.log('Inserting Vendors...');
  for (const v of testData.vendors) {
    await prisma.vendor.create({
      data: {
        name: v.vendorName,
        phone: v.phone,
        service: v.serviceType,
        company: v.companyName,
        properties: {
          connect: v.properties.map((pName: string) => ({ id: getProp(pName)?.id }))
        }
      }
    });
  }

  // 5. Taxes
  console.log('Inserting Taxes...');
  for (const t of testData.taxRecords) {
    await prisma.taxRecord.create({
      data: {
        propertyId: getProp(t.propertyName)!.id,
        taxType: t.taxType,
        assessmentNumber: t.assessmentNumber,
        frequency: t.taxFrequency,
        annualTaxAmount: t.taxAmount,
        currentTaxPeriod: t.taxPeriod,
        nextDueDate: new Date(t.nextDueDate),
        taxOwnership: 'PROPERTY'
      }
    });
  }

  // 6. Tenants
  console.log('Inserting Tenants...');
  for (const t of testData.tenants) {
    const p = getProp(t.propertyName);
    const unit = t.unit;
    let fullUnitStr = unit === 'PROPERTY' ? t.propertyName : `${t.propertyName} / ${unit}`;
    
    const resolved = resolveUnit(fullUnitStr);

    await prisma.tenant.create({
      data: {
        name: t.fullName,
        phone: t.phone,
        email: t.email,
        propertyId: p!.id,
        roomId: resolved.roomId,
        homeId: resolved.homeId,
        ...(resolved.bedId ? { bed: { connect: { id: resolved.bedId } } } : {}),
        rent: t.agreedMonthlyRent,
        deposit: t.securityDeposit,
        joiningDate: new Date(t.joiningDate),
      }
    });
  }

  // 7. Agreements
  console.log('Inserting Agreements...');
  const allTenants = await prisma.tenant.findMany();
  for (const a of testData.agreements) {
    const tenant = allTenants.find(t => t.name === a.tenant);
    const pName = a.propertyUnit.split(' / ')[0];
    const p = getProp(pName);
    const resolved = resolveUnit(a.propertyUnit);

    await prisma.agreement.create({
      data: {
        agreementNumber: 'AGR-' + Math.floor(Math.random()*1000000),
        tenantId: tenant!.id,
        propertyId: p!.id,
        homeId: resolved.homeId,
        startDate: new Date(a.startDate),
        endDate: new Date(a.endDate),
        rent: a.monthlyRent,
        deposit: a.securityDeposit,
      }
    });
  }

  // 8. Bills
  console.log('Inserting Bills...');
  for (const b of testData.bills) {
    const tenant = allTenants.find(t => t.name === b.resident);
    const pName = b.propertyUnit.split(' / ')[0];
    const p = getProp(pName);
    const resolved = resolveUnit(b.propertyUnit);
    
    await prisma.bill.create({
      data: {
        billNumber: b.billNumber,
        tenantId: tenant!.id,
        propertyId: p!.id,
        homeId: resolved.homeId,
        billType: b.billType,
        billingMonth: b.billingMonth,
        dueDate: new Date(b.dueDate),
        amount: b.amount,
      }
    });
  }

  // 9. Payments
  console.log('Inserting Payments...');
  for (const pay of testData.payments) {
    const tenant = allTenants.find(t => t.name === pay.resident);
    
    await prisma.payment.create({
      data: {
        tenantId: tenant!.id,
        propertyId: tenant!.propertyId!,
        amount: pay.amount,
        paymentDate: new Date(pay.paymentDate),
        paymentMethod: pay.method === 'UPI' ? 'UPI' : (pay.method === 'CASH' ? 'CASH' : 'BANK_TRANSFER'),
        allocations: {
          create: pay.allocations.map((alloc: any) => ({
            bill: { connect: { billNumber: alloc.billNumber } },
            amount: alloc.amount
          }))
        }
      }
    });
  }

  // 10. Expenses
  console.log('Inserting Expenses...');
  for (const e of testData.expenses) {
    await prisma.expense.create({
      data: {
        category: e.category,
        amount: e.amount,
        expenseDate: new Date(e.expenseDate),
        description: e.description,
        propertyId: getProp(e.propertyName)?.id,
      }
    });
  }

  // 11. MaintenanceRequests
  console.log('Inserting Maintenance...');
  const allStaff = await prisma.staff.findMany();
  const allVendors = await prisma.vendor.findMany();

  for (const m of testData.maintenanceRequests) {
    await prisma.maintenanceRequest.create({
      data: {
        propertyId: getProp(m.propertyName)!.id,
        category: m.category,
        priority: m.priority,
        estimatedCost: m.estimatedCost,
        description: m.issueDescription,
        assignedStaffId: allStaff.find(s => s.name === m.assignStaff)?.id,
        assignedVendorId: allVendors.find(v => v.name === m.assignVendor)?.id,
      }
    });
  }

  console.log('Successfully inserted all test data.');
}

main().catch(console.error).finally(() => prisma.$disconnect());
