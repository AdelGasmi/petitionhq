/**
 * check-freshness.ts
 *
 * Fails CI when any article's dateModified is more than 180 days old.
 * Run via: npm run check:freshness
 */

import { ARTICLES } from "../content/articles";

const MAX_AGE_DAYS = 180;
const now = Date.now();
const maxAgeMs = MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

const stale = ARTICLES.filter(({ meta }) => {
  const modified = new Date(meta.dateModified).getTime();
  return now - modified > maxAgeMs;
});

if (stale.length === 0) {
  console.log(`✓ All ${ARTICLES.length} articles are fresh (within ${MAX_AGE_DAYS} days).`);
  process.exit(0);
} else {
  console.error(`\n✗ ${stale.length} article(s) have not been updated in over ${MAX_AGE_DAYS} days:\n`);
  for (const { meta } of stale) {
    const days = Math.floor((now - new Date(meta.dateModified).getTime()) / (24 * 60 * 60 * 1000));
    console.error(`  ${days}d stale — "${meta.title}" (${meta.slug})`);
    console.error(`           dateModified: ${meta.dateModified}`);
  }
  console.error(`\nUpdate the dateModified field and re-review each stale article before merging.`);
  process.exit(1);
}
