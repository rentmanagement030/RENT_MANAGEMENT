import { processAutomatedNotifications } from "../services/notification.service";
import { prisma } from "../config/prisma";

async function main() {
  console.log("Triggering automated scheduler for 7904006320...");
  const res = await processAutomatedNotifications(false);
  console.log("Scheduler result:", res);
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
