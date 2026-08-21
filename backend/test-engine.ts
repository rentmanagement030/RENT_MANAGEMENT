import { getPeriodFinancialSummaryEngine } from './src/financial/financial.engine';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const result = await getPeriodFinancialSummaryEngine(prisma, {});
  console.log(JSON.stringify(result, null, 2));
}

main().finally(() => prisma.$disconnect());
