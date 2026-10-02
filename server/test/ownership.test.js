/**
 * ResQ — authorization tests.
 *
 * The one the build prompt asks for by name: a HOSPITAL_ADMIN holding a token
 * for facility A must get 403 on facility B. Hiding the button in the UI is not
 * a control; this is what proves the control exists.
 *
 * Requires a migrated, seeded database:
 *   npm run prisma:generate && npm run prisma:migrate && npm run seed
 *   node --test test/
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';
import { getPrisma, disconnectPrisma } from '../src/lib/prisma.js';

const DEMO_PASSWORD = 'ResQDemo!2026';
let server;
let base;

test.before(async () => {
  server = createApp().listen(0);
  await new Promise((r) => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}/api/v1`;
});

test.after(async () => {
  server?.close();
  await disconnectPrisma();
});

async function login(email) {
  const res = await fetch(`${base}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: DEMO_PASSWORD }),
  });
  assert.equal(res.status, 200, `login failed for ${email}`);
  const body = await res.json();
  return body.data.tokens.accessToken;
}

const authed = (token, body) => ({
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  body: JSON.stringify(body),
});

test('a hospital admin may update their own facility', async () => {
  const prisma = await getPrisma();
  const token = await login('hospital@demo.resq');

  const owned = await prisma.facilityAdmin.findFirst({
    where: { user: { email: 'hospital@demo.resq' } },
    select: { facilityId: true },
  });
  assert.ok(owned, 'seed did not link hospital@demo.resq to a facility');

  const res = await fetch(
    `${base}/hospital-admin/availability`,
    authed(token, {
      facilityId: owned.facilityId,
      updates: [{ resourceType: 'ICU_BED', status: 'LIMITED', count: 2 }],
    }),
  );

  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);
  assert.equal(body.data.facilityId, owned.facilityId);
});

test('a hospital admin gets 403 on a facility they do not manage', async () => {
  const prisma = await getPrisma();
  const token = await login('hospital@demo.resq');

  const other = await prisma.facilityAdmin.findFirst({
    where: { user: { email: 'hospital2@demo.resq' } },
    select: { facilityId: true },
  });
  assert.ok(other, 'seed did not link hospital2@demo.resq to a facility');

  const res = await fetch(
    `${base}/hospital-admin/availability`,
    authed(token, {
      facilityId: other.facilityId,
      updates: [{ resourceType: 'ICU_BED', status: 'AVAILABLE', count: 99 }],
    }),
  );

  assert.equal(res.status, 403, 'cross-facility write was not refused');
  const body = await res.json();
  assert.equal(body.error.code, 'FORBIDDEN');

  // And nothing was written.
  const row = await prisma.facilityAvailability.findUnique({
    where: {
      facilityId_resourceType: { facilityId: other.facilityId, resourceType: 'ICU_BED' },
    },
  });
  assert.notEqual(row?.count, 99, 'a refused request still changed data');
});

test('a plain user gets 403 on the hospital admin routes', async () => {
  const token = await login('user@demo.resq');
  const res = await fetch(`${base}/hospital-admin/facility`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 403);
});

test('a plain user gets 403 on the admin report queue', async () => {
  const token = await login('user@demo.resq');
  const res = await fetch(`${base}/admin/reports`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 403);
});

test('registration cannot grant itself a role', async () => {
  const email = `escalate-${Date.now()}@demo.resq`;
  const res = await fetch(`${base}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: 'Escalation Attempt',
      email,
      password: 'correct-horse-battery-staple',
      role: 'SUPER_ADMIN',
    }),
  });

  assert.equal(res.status, 201);
  const body = await res.json();
  assert.equal(body.data.user.role, 'USER', 'client-supplied role was honoured');

  const prisma = await getPrisma();
  await prisma.user.deleteMany({ where: { email } });
});

test('no facility response omits provenance', async () => {
  const res = await fetch(`${base}/facilities/nearby?lat=26.9124&lng=75.7873&radiusKm=25`);
  assert.equal(res.status, 200);
  const body = await res.json();

  for (const facility of body.data.items) {
    assert.ok(facility.provenance, `${facility.name} has no provenance block`);
    assert.ok(facility.provenance.freshnessStatus, `${facility.name} has no freshnessStatus`);

    for (const row of facility.availability) {
      assert.ok(row.freshnessStatus, 'availability row has no freshnessStatus');
      // The core safety rule, asserted against live data.
      if (row.lastUpdatedAt == null) {
        assert.equal(row.status, 'UNKNOWN', 'availability claimed without a timestamp');
        assert.equal(row.freshnessStatus, 'UNKNOWN');
      }
    }
  }
});
