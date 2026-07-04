// One-off verification: render the v2 daily report (with Daily Burn line)
// and record the north-star metric for a user.
// Usage: npx tsx scripts/test-northstar-report.mjs <user_id>
import { config } from 'dotenv';
config({ path: '.env.local' });

const userId = process.argv[2];
if (!userId) {
  console.error('Usage: npx tsx scripts/test-northstar-report.mjs <user_id>');
  process.exit(1);
}

const { generateDailyReportV2 } = await import('../utils/sms/template-parts/daily-report-v2.ts');
const { recordNorthstarMetric } = await import('../utils/metrics/northstar.ts');

console.log('--- Daily Report v2 ---');
console.log(await generateDailyReportV2(userId));
console.log('\n--- Northstar record ---');
console.log(await recordNorthstarMetric(userId));
