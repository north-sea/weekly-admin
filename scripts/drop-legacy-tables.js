const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const LEGACY_TABLES = ['drafts', 'rss_sources'];

async function checkTables() {
  const rows = await prisma.$queryRaw`SHOW TABLES`;
  const tableNames = new Set(
    rows.flatMap((row) => Object.values(row).map((value) => String(value).toLowerCase()))
  );
  return LEGACY_TABLES.map((table) => ({
    table,
    exists: tableNames.has(table),
  }));
}

async function dropTables(tables) {
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS=0`;
  for (const table of tables) {
    await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS \`${table}\``);
  }
  await prisma.$executeRaw`SET FOREIGN_KEY_CHECKS=1`;
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has('--apply');

  console.log('========================================');
  console.log('Legacy tables cleanup');
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('========================================\n');

  const before = await checkTables();
  console.log('Before:', before);

  const toDrop = before.filter((row) => row.exists).map((row) => row.table);
  if (toDrop.length === 0) {
    console.log('✅ No legacy tables to drop.');
    return;
  }

  if (!apply) {
    console.log('ℹ️ Dry-run: use --apply to drop tables:', toDrop);
    return;
  }

  await dropTables(toDrop);

  const after = await checkTables();
  console.log('After:', after);

  const stillExists = after.filter((row) => row.exists).map((row) => row.table);
  if (stillExists.length > 0) {
    throw new Error(`Failed to drop tables: ${stillExists.join(', ')}`);
  }

  console.log('🎉 Legacy tables dropped successfully.');
}

main()
  .catch((error) => {
    console.error('❌ Cleanup failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
