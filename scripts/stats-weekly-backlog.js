#!/usr/bin/env node
require('dotenv').config();

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const isoWeek = require('dayjs/plugin/isoWeek');
dayjs.extend(utc);
dayjs.extend(isoWeek);

const { PrismaClient } = require('@prisma/client');

function getWeekRangeByOffset(offset = 0) {
  const targetDate = dayjs().utc().add(offset, 'week');
  const monday = targetDate.isoWeekday(1).startOf('day');
  const sunday = targetDate.isoWeekday(7).endOf('day');
  return {
    startDate: monday.toDate(),
    endDate: sunday.toDate(),
    startDateStr: monday.format('YYYY-MM-DD'),
    endDateStr: sunday.format('YYYY-MM-DD'),
  };
}

function formatDate(d) {
  if (!d) return '-';
  return dayjs(d).utc().format('YYYY-MM-DD HH:mm:ss[Z]');
}

async function main() {
  const nextWeekRange = getWeekRangeByOffset(1);
  const currentWeekRange = getWeekRangeByOffset(0);

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: process.env.DATABASE_URL,
      },
    },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

  try {
    console.log('=== Weekly Admin DB Stats ===');
    console.log(`Now (UTC): ${dayjs().utc().format('YYYY-MM-DD HH:mm:ss[Z]')}`);
    console.log(
      `Next week (offset=1, UTC isoWeek): ${nextWeekRange.startDateStr} ~ ${nextWeekRange.endDateStr}`
    );
    console.log(
      `Current week (offset=0, UTC isoWeek): ${currentWeekRange.startDateStr} ~ ${currentWeekRange.endDateStr}`
    );
    console.log('');

    // -----------------------------------------------------------------------
    // Karakeep drafts (inbox_items)
    // -----------------------------------------------------------------------
    const karakeepSources = await prisma.data_sources.findMany({
      where: { type: 'karakeep' },
      select: { id: true, name: true, enabled: true },
      orderBy: { id: 'asc' },
    });

    console.log('--- Karakeep Sources ---');
    if (karakeepSources.length === 0) {
      console.log('No karakeep sources found in data_sources.');
    } else {
      for (const s of karakeepSources) {
        console.log(`- id=${s.id} name=${s.name} enabled=${s.enabled}`);
      }
    }
    console.log('');

    const karakeepSourceIds = karakeepSources.map((s) => s.id);
    if (karakeepSourceIds.length > 0) {
      const totalInbox = await prisma.inbox_items.count({
        where: { source_id: { in: karakeepSourceIds } },
      });

      const statusRows = await prisma.inbox_items.groupBy({
        by: ['status'],
        where: { source_id: { in: karakeepSourceIds } },
        _count: { _all: true },
      });

      const pendingUnpromoted = await prisma.inbox_items.count({
        where: {
          source_id: { in: karakeepSourceIds },
          status: 'pending',
          content_id: null,
        },
      });

      const pendingPromoted = await prisma.inbox_items.count({
        where: {
          source_id: { in: karakeepSourceIds },
          status: 'pending',
          content_id: { not: null },
        },
      });

      const lastCollected = await prisma.inbox_items.findFirst({
        where: { source_id: { in: karakeepSourceIds } },
        orderBy: { collected_at: 'desc' },
        select: { collected_at: true },
      });

      console.log('--- Karakeep Inbox Items (DB) ---');
      console.log(`Total inbox_items from karakeep: ${totalInbox}`);
      console.log('By status:');
      const statusOrder = ['pending', 'promoted', 'rejected', 'duplicate', null];
      const statusMap = new Map();
      for (const r of statusRows) statusMap.set(r.status ?? null, r._count._all);
      for (const s of statusOrder) {
        const label = s ?? 'null';
        console.log(`- ${label}: ${statusMap.get(s) ?? 0}`);
      }
      console.log(`Pending & content_id is NULL (unpromoted): ${pendingUnpromoted}`);
      console.log(`Pending & content_id NOT NULL (linked content exists): ${pendingPromoted}`);
      console.log(`Latest collected_at: ${formatDate(lastCollected?.collected_at ?? null)}`);
      console.log('');
    }

    // -----------------------------------------------------------------------
    // Weekly issues counts up to next week
    // -----------------------------------------------------------------------
    const totalWeeklyIssues = await prisma.weekly_issues.count();
    const issuesThroughNextWeek = await prisma.weekly_issues.count({
      where: {
        end_date: { lte: nextWeekRange.endDate },
      },
    });

    const nextWeekIssue = await prisma.weekly_issues.findFirst({
      where: {
        start_date: nextWeekRange.startDate,
        end_date: nextWeekRange.endDate,
      },
      select: { id: true, issue_number: true, title: true, status: true },
    });

    console.log('--- Weekly Issues ---');
    console.log(`Total weekly_issues: ${totalWeeklyIssues}`);
    console.log(
      `weekly_issues with end_date <= ${nextWeekRange.endDateStr}: ${issuesThroughNextWeek}`
    );
    console.log(
      nextWeekIssue
        ? `Next week issue exists: #${nextWeekIssue.issue_number} (${nextWeekIssue.status}) id=${nextWeekIssue.id}`
        : 'Next week issue exists: NO'
    );
    console.log('');

    // -----------------------------------------------------------------------
    // Content pool (ready/published, type=3) for recent weeks (even if issue missing)
    // -----------------------------------------------------------------------
    console.log('--- Content Pool (type=3, ready/published) ---');
    for (const offset of [-4, -3, -2, -1, 0, 1]) {
      const range = getWeekRangeByOffset(offset);
      const totalInWeek = await prisma.contents.count({
        where: {
          content_type_id: 3,
          status: { in: ['ready', 'published'] },
          created_at: { gte: range.startDate, lte: range.endDate },
        },
      });
      const unlinkedInWeek = await prisma.contents.count({
        where: {
          content_type_id: 3,
          status: { in: ['ready', 'published'] },
          created_at: { gte: range.startDate, lte: range.endDate },
          weekly_content_items: { none: {} },
        },
      });

      console.log(
        `weekOffset=${offset} ${range.startDateStr}~${range.endDateStr} total=${totalInWeek} unlinked=${unlinkedInWeek}`
      );
    }
    console.log('');

    // -----------------------------------------------------------------------
    // Per-issue supply/demand snapshot (up to next week)
    // -----------------------------------------------------------------------
    const targetPerIssue = 15;
    const issueSnapshots = await prisma.$queryRaw`
      SELECT
        wi.id,
        wi.issue_number,
        wi.status,
        wi.start_date,
        wi.end_date,
        (
          SELECT COUNT(*)
          FROM weekly_content_items wci
          WHERE wci.weekly_issue_id = wi.id
        ) AS linked_count,
        (
          SELECT COUNT(*)
          FROM contents c
          WHERE
            c.content_type_id = 3
            AND c.status IN ('ready', 'published')
            AND c.created_at IS NOT NULL
            AND DATE(c.created_at) BETWEEN wi.start_date AND wi.end_date
            AND NOT EXISTS (
              SELECT 1
              FROM weekly_content_items wci2
              WHERE wci2.content_id = c.id
            )
        ) AS eligible_unlinked_count,
        (
          SELECT COUNT(*)
          FROM contents c
          WHERE
            c.content_type_id = 3
            AND c.status IN ('ready', 'published')
            AND c.created_at IS NOT NULL
            AND DATE(c.created_at) BETWEEN wi.start_date AND wi.end_date
            AND EXISTS (
              SELECT 1
              FROM weekly_content_items wci3
              WHERE wci3.content_id = c.id
                AND wci3.weekly_issue_id <> wi.id
            )
        ) AS conflicted_count
      FROM weekly_issues wi
      WHERE wi.end_date <= ${nextWeekRange.endDate}
      ORDER BY wi.issue_number DESC
      LIMIT 30
    `;

    console.log('--- Last 30 Weekly Issues (through next week) ---');
    console.log(`Target per issue (default automation cap): ${targetPerIssue}`);
    for (const row of issueSnapshots) {
      const linked = Number(row.linked_count);
      const eligible = Number(row.eligible_unlinked_count);
      const conflicted = Number(row.conflicted_count);
      const missing = Math.max(0, targetPerIssue - linked);
      const canFill = Math.min(missing, eligible);

      console.log(
        `#${row.issue_number} (${row.status}) ${dayjs(row.start_date).utc().format('YYYY-MM-DD')}~${dayjs(row.end_date).utc().format('YYYY-MM-DD')}` +
          ` linked=${linked} eligible_unlinked=${eligible} conflicted=${conflicted} missing_to_${targetPerIssue}=${missing} can_fill_now=${canFill}`
      );
    }

    const emptyIssuesCountRows = await prisma.$queryRaw`
      SELECT COUNT(*) AS count
      FROM (
        SELECT wi.id
        FROM weekly_issues wi
        LEFT JOIN weekly_content_items wci ON wi.id = wci.weekly_issue_id
        GROUP BY wi.id
        HAVING COUNT(wci.id) = 0
      ) t
    `;

    const emptyIssuesCount = Number(emptyIssuesCountRows?.[0]?.count ?? 0);

    console.log('');
    console.log('--- Empty Issues (global) ---');
    console.log(`Empty weekly_issues (no weekly_content_items): ${emptyIssuesCount}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Stats failed:', error instanceof Error ? error.message : error);
  process.exit(1);
});
