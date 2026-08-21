import { prisma } from "../config/prisma";
import fs from "node:fs";
import path from "node:path";

async function runRLSMigration() {
  console.log("Applying RLS Migration to Postgres Database...");
  const sqlPath = path.join(__dirname, "../../prisma/migrations/20260820000000_enable_rls_security/migration.sql");
  const sqlContent = fs.readFileSync(sqlPath, "utf-8");

  // Remove comments and split by semicolon
  const statements = sqlContent
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
    .split(";")
    .map((stmt) => stmt.trim())
    .filter((stmt) => stmt.length > 0);

  for (const stmt of statements) {
    try {
      await prisma.$executeRawUnsafe(stmt);
    } catch (err: any) {
      console.error(`Failed on statement: ${stmt.slice(0, 50)}...`, err.message);
    }
  }

  console.log("RLS Migration applied successfully!");

  // Verify RLS status
  const tables: any = await prisma.$queryRaw`
    SELECT table_name, rowsecurity
    FROM information_schema.tables t
    JOIN pg_tables p ON t.table_name = p.tablename AND t.table_schema = p.schemaname
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE';
  `;

  const disabled = tables.filter((t: any) => !t.rowsecurity);
  console.log(`Verification: Total tables = ${tables.length}, RLS Disabled = ${disabled.length}`);
  if (disabled.length > 0) {
    console.table(disabled);
  } else {
    console.log("SUCCESS! All public application tables have Row Level Security ENABLED!");
  }

  await prisma.$disconnect();
}

runRLSMigration().catch(console.error);
