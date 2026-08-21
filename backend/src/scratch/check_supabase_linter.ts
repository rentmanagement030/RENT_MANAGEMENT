import { prisma } from "../config/prisma";

async function checkLinter() {
  console.log("=================================================================");
  console.log("            SUPABASE POSTGRESQL SECURITY LINTER CHECK            ");
  console.log("=================================================================\n");

  // 1. Check RLS Disabled in Public
  const rlsDisabled: any = await prisma.$queryRaw`
    SELECT t.table_name
    FROM information_schema.tables t
    JOIN pg_tables p ON t.table_name = p.tablename AND t.table_schema = p.schemaname
    WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' AND p.rowsecurity = false;
  `;

  console.log(`1. rls_disabled_in_public (Errors: ${rlsDisabled.length})`);
  if (rlsDisabled.length > 0) {
    console.table(rlsDisabled);
  } else {
    console.log("  ✓ ZERO tables with RLS disabled in public schema.\n");
  }

  // 2. Check Always True Policies (qual = 'true' or with_check = 'true')
  const alwaysTrue: any = await prisma.$queryRaw`
    SELECT policyname, tablename, roles, cmd, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (qual = 'true' OR with_check = 'true');
  `;

  console.log(`2. rls_policy_always_true (Warnings: ${alwaysTrue.length})`);
  if (alwaysTrue.length > 0) {
    console.table(alwaysTrue);
  } else {
    console.log("  ✓ ZERO policies with USING (true) or WITH CHECK (true).\n");
  }

  // 3. Check RLS Enabled with No Policy
  const noPolicy: any = await prisma.$queryRaw`
    SELECT t.tablename
    FROM pg_tables t
    LEFT JOIN pg_policies p ON t.tablename = p.tablename AND t.schemaname = p.schemaname
    WHERE t.schemaname = 'public' AND t.rowsecurity = true AND p.policyname IS NULL;
  `;

  console.log(`3. rls_enabled_no_policy (Tables: ${noPolicy.length})`);
  if (noPolicy.length > 0) {
    console.table(noPolicy);
  } else {
    console.log("  ✓ All RLS-enabled tables have explicit policies defined.\n");
  }

  await prisma.$disconnect();
}

checkLinter().catch(console.error);
