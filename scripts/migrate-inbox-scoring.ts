import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const cols: unknown[] = await prisma.$queryRaw`SHOW COLUMNS FROM inbox_items LIKE 'scoring_status'`;
  if (cols.length > 0) {
    console.log('scoring_status column already exists, skipping');
    return;
  }

  console.log('Adding scoring_status column...');
  await prisma.$executeRaw`ALTER TABLE inbox_items ADD COLUMN scoring_status VARCHAR(20) NULL DEFAULT 'pending'`;
  await prisma.$executeRaw`CREATE INDEX idx_inbox_scoring_status ON inbox_items(scoring_status, created_at)`;

  const contentCols: unknown[] = await prisma.$queryRaw`SHOW COLUMNS FROM contents LIKE 'auto_promoted'`;
  if (contentCols.length === 0) {
    console.log('Adding auto_promoted column to contents...');
    await prisma.$executeRaw`ALTER TABLE contents ADD COLUMN auto_promoted BOOLEAN NULL DEFAULT FALSE`;
    await prisma.$executeRaw`CREATE INDEX idx_contents_auto_promoted ON contents(auto_promoted, created_at)`;
  }

  console.log('Marking existing scored items as done...');
  const updated = await prisma.$executeRaw`UPDATE inbox_items SET scoring_status = 'done' WHERE ai_score IS NOT NULL`;
  console.log(`  ${updated} items marked as done`);

  console.log('Seeding ai_settings...');
  await prisma.$executeRaw`
    INSERT INTO ai_settings (\`key\`, value)
    VALUES
      ('inbox_promotion_threshold', JSON_OBJECT('value', 70)),
      ('inbox_scoring_enabled', JSON_OBJECT('value', CAST(true AS JSON))),
      ('inbox_scoring_batch_size', JSON_OBJECT('value', 50)),
      ('inbox_scoring_processing_timeout_minutes', JSON_OBJECT('value', 10))
    ON DUPLICATE KEY UPDATE value = ai_settings.value
  `;

  console.log('Migration complete!');
}

run()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
