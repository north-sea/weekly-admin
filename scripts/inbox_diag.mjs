import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
function bjson(o){return JSON.parse(JSON.stringify(o,(k,v)=>typeof v==='bigint'?Number(v):v));}
try {
  const byStatus = await prisma.$queryRawUnsafe(
    "SELECT scoring_status, COUNT(*) c FROM inbox_items GROUP BY scoring_status ORDER BY c DESC"
  );
  console.log('=== scoring_status 分布 ===');
  console.log(JSON.stringify(bjson(byStatus)));

  const failedSample = await prisma.$queryRawUnsafe(
    "SELECT JSON_UNQUOTE(JSON_EXTRACT(ai_score_details,'$.error')) err, COUNT(*) c FROM inbox_items WHERE scoring_status='failed' GROUP BY err ORDER BY c DESC LIMIT 15"
  );
  console.log('=== failed 的 error 分布 ===');
  console.log(JSON.stringify(bjson(failedSample)));

  const pendingRetry = await prisma.$queryRawUnsafe(
    "SELECT COALESCE(JSON_EXTRACT(ai_score_details,'$.retry_count'),0) rc, COUNT(*) c FROM inbox_items WHERE scoring_status='pending' GROUP BY rc ORDER BY c DESC LIMIT 10"
  );
  console.log('=== pending 的 retry_count 分布 ===');
  console.log(JSON.stringify(bjson(pendingRetry)));

  const pendingErr = await prisma.$queryRawUnsafe(
    "SELECT JSON_UNQUOTE(JSON_EXTRACT(ai_score_details,'$.error')) err, COUNT(*) c FROM inbox_items WHERE scoring_status='pending' AND ai_score_details IS NOT NULL GROUP BY err ORDER BY c DESC LIMIT 15"
  );
  console.log('=== pending 且带 error 的分布 ===');
  console.log(JSON.stringify(bjson(pendingErr)));

  const summ = await prisma.$queryRawUnsafe(
    "SELECT summarization_status ss, COUNT(*) c FROM inbox_items GROUP BY ss ORDER BY c DESC"
  );
  console.log('=== summarization_status 分布 ===');
  console.log(JSON.stringify(bjson(summ)));

  const noSummary = await prisma.$queryRawUnsafe(
    "SELECT (summary IS NULL OR TRIM(summary)='') noSummary, COUNT(*) c FROM inbox_items WHERE scoring_status IN ('pending','failed') GROUP BY noSummary"
  );
  console.log('=== pending/failed 中无摘要占比 ===');
  console.log(JSON.stringify(bjson(noSummary)));
} catch(e){
  console.error('DIAG_ERROR', e.message);
} finally {
  await prisma.$disconnect();
}
