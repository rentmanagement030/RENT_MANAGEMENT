import "dotenv/config";
import { prisma } from "../src/config/prisma";
import { logger } from "../src/utils/logger";

async function main() {
  logger.info("Cleaning up automated test properties...");

  // Delete properties containing "Test Executive PG Hub" or "Updated Royal PG Tower"
  const testProps = await prisma.property.findMany({
    where: {
      OR: [
        { name: { contains: "Test Executive PG Hub", mode: "insensitive" } },
        { name: { contains: "Updated Royal PG Tower", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true },
  });

  const ids = testProps.map((p) => p.id);
  logger.info(`Found ${ids.length} test properties to delete.`);

  if (ids.length > 0) {
    await prisma.$transaction([
      prisma.propertyImage.deleteMany({ where: { propertyId: { in: ids } } }),
      prisma.pgBed.deleteMany({ where: { room: { propertyId: { in: ids } } } }),
      prisma.pgRoom.deleteMany({ where: { propertyId: { in: ids } } }),
      prisma.property.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }

  const remainingProperties = await prisma.property.findMany({
    where: { archived: false },
    include: {
      rooms: {
        include: { beds: { where: { archived: false } } },
      },
    },
  });

  console.log("=================================================");
  console.log("REMAINING USER PROPERTIES IN DATABASE:");
  remainingProperties.forEach((p) => {
    const beds = p.rooms.reduce((s, r) => s + r.beds.length, 0);
    console.log(`- ${p.name} (${p.type}): ${p.rooms.length} Rooms, ${beds} Beds`);
  });

  const totalBeds = remainingProperties.reduce(
    (sum, p) => sum + p.rooms.reduce((s, r) => s + r.beds.length, 0),
    0
  );
  const totalHouses = remainingProperties.filter((p) => p.type === "HOUSE").length;

  console.log(`TOTAL REAL HOUSES: ${totalHouses}`);
  console.log(`TOTAL REAL PG BEDS: ${totalBeds}`);
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
