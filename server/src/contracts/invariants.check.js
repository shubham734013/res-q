/**
 * ResQ — contract invariant checks.
 * Plain node, no test runner needed:  npm run check:contracts
 */
import { AvailabilitySummary, NearbyQuery } from './facility.js';
import { UpdateReportRequest } from './reports.js';
import { AvailabilityUpdateItem } from './hospitalAdmin.js';
import { RegisterRequest } from './auth.js';
import { deriveFreshness, buildProvenance, freshnessLabel } from '../lib/freshness.js';

let pass = 0, fail = 0;
const t = (name, ok) => {
  if (ok) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
};

const base = {
  resourceType: 'ICU_BED', count: null, note: null,
  source: 'Verified Hospital Update', sourceType: 'VERIFIED_PROVIDER',
};

console.log('Safety invariants:');
t('rejects AVAILABLE with no timestamp',
  !AvailabilitySummary.safeParse({ ...base, status: 'AVAILABLE', lastUpdatedAt: null, freshnessStatus: 'UNKNOWN' }).success);
t('accepts UNKNOWN with no timestamp',
  AvailabilitySummary.safeParse({ ...base, status: 'UNKNOWN', lastUpdatedAt: null, freshnessStatus: 'UNKNOWN' }).success);
t('rejects null timestamp claiming RECENT',
  !AvailabilitySummary.safeParse({ ...base, status: 'UNKNOWN', lastUpdatedAt: null, freshnessStatus: 'RECENT' }).success);
t('rejects DEMO source presented as RECENT',
  !AvailabilitySummary.safeParse({ ...base, sourceType: 'DEMO', status: 'AVAILABLE', lastUpdatedAt: new Date().toISOString(), freshnessStatus: 'RECENT' }).success);
t('accepts a properly sourced AVAILABLE',
  AvailabilitySummary.safeParse({ ...base, status: 'AVAILABLE', lastUpdatedAt: new Date().toISOString(), freshnessStatus: 'RECENT' }).success);

console.log('\nQuery validation:');
t('rejects radius above the ceiling', !NearbyQuery.safeParse({ lat: '26.9', lng: '75.7', radiusKm: '500' }).success);
t('rejects out-of-range latitude', !NearbyQuery.safeParse({ lat: '95', lng: '75.7' }).success);
const q = NearbyQuery.safeParse({ lat: '26.9', lng: '75.7', emergency: 'false' });
t('emergency=false parses as false, not true', q.success && q.data.emergency === false);
t('applies default radius and sort', q.success && q.data.radiusKm === 10 && q.data.sort === 'DISTANCE');

console.log('\nWrite-path guards:');
t('rejects resolving a report with no note', !UpdateReportRequest.safeParse({ status: 'RESOLVED' }).success);
t('accepts resolving with a note', UpdateReportRequest.safeParse({ status: 'RESOLVED', resolutionNote: 'Phone corrected.' }).success);
t('rejects FULL with a positive count', !AvailabilityUpdateItem.safeParse({ resourceType: 'ICU_BED', status: 'FULL', count: 3 }).success);
t('rejects UNKNOWN carrying a count', !AvailabilityUpdateItem.safeParse({ resourceType: 'ICU_BED', status: 'UNKNOWN', count: 3 }).success);

console.log('\nPrivilege escalation:');
const reg = RegisterRequest.safeParse({ name: 'Test User', email: 'a@b.co', password: 'correct-horse-battery', role: 'SUPER_ADMIN' });
t('register strips a client-supplied role', reg.success && reg.data.role === undefined);
t('rejects a short password', !RegisterRequest.safeParse({ name: 'Test User', email: 'a@b.co', password: 'short' }).success);

console.log('\nFreshness engine:');
const now = new Date('2026-10-01T12:00:00Z');
t('5 min old -> RECENT', deriveFreshness({ lastUpdatedAt: new Date('2026-10-01T11:55:00Z'), sourceType: 'VERIFIED_PROVIDER', now }) === 'RECENT');
t('3 hours old -> STALE', deriveFreshness({ lastUpdatedAt: new Date('2026-10-01T09:00:00Z'), sourceType: 'VERIFIED_PROVIDER', now }) === 'STALE');
t('no timestamp -> UNKNOWN', deriveFreshness({ lastUpdatedAt: null, sourceType: 'VERIFIED_PROVIDER', now }) === 'UNKNOWN');
t('seeded data -> DEMO regardless of age', deriveFreshness({ lastUpdatedAt: new Date('2026-10-01T11:59:00Z'), sourceType: 'DEMO', now }) === 'DEMO');
// Regression: DEMO used to win over a missing timestamp, which produced a
// provenance block that failed the contract it was supposed to satisfy.
t('DEMO with no timestamp -> UNKNOWN, not DEMO', deriveFreshness({ lastUpdatedAt: null, sourceType: 'DEMO', now }) === 'UNKNOWN');
t('a timestamp-less DEMO row still serializes validly',
  AvailabilitySummary.safeParse({ ...base, ...buildProvenance({ sourceName: 'Demo data', sourceType: 'DEMO', lastUpdatedAt: null, now }), status: 'UNKNOWN' }).success);
t('future timestamp -> UNKNOWN, not RECENT', deriveFreshness({ lastUpdatedAt: new Date('2026-10-01T18:00:00Z'), sourceType: 'OFFICIAL', now }) === 'UNKNOWN');
t('non-live OFFICIAL source cannot claim REAL_TIME', deriveFreshness({ lastUpdatedAt: new Date('2026-10-01T11:59:00Z'), sourceType: 'OFFICIAL', now }) === 'RECENT');
const p = buildProvenance({ sourceName: null, sourceType: 'THIRD_PARTY', lastUpdatedAt: null, now });
t('buildProvenance emits a valid UNKNOWN block', AvailabilitySummary.safeParse({ ...base, ...p, status: 'UNKNOWN' }).success);
t('label for a missing timestamp says so',
  freshnessLabel({ freshnessStatus: 'UNKNOWN', lastUpdatedAt: null }, now) === 'No recent information');
t('label renders minutes',
  freshnessLabel({ freshnessStatus: 'RECENT', lastUpdatedAt: '2026-10-01T11:42:00Z' }, now) === 'Updated 18 min ago');

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail === 0 ? 0 : 1);
