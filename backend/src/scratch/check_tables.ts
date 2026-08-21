import { prisma } from "../config/prisma";

async function main() {
  const tables: any = await prisma.$queryRaw`
    SELECT table_name, rowsecurity
    FROM information_schema.tables t
    JOIN pg_tables p ON t.table_name = p.tablename AND t.table_schema = p.schemaname
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
  `;
  console.log("All Public Tables & RLS Status:");
  console.table(tables);
  await prisma.$disconnect();
}

main().catch(console.error);
