/**
 * ResQ — Prisma client singleton.
 *
 * Imported lazily so a missing generated client produces one clear instruction
 * rather than an opaque stack trace from whichever route happened to run first.
 */

import { env, isProduction } from './env.js';

let client = null;

export async function getPrisma() {
  if (client) return client;

  let PrismaClient;
  try {
    ({ PrismaClient } = await import('@prisma/client'));
  } catch {
    throw new Error(
      'Prisma Client is not generated. Run:  npm run prisma:generate\n' +
        '(then  npm run prisma:migrate  to create the tables)',
    );
  }

  client = new PrismaClient({
    log: isProduction ? ['warn', 'error'] : ['warn', 'error'],
    datasources: { db: { url: env.DATABASE_URL } },
  });

  return client;
}

export async function disconnectPrisma() {
  if (client) {
    await client.$disconnect();
    client = null;
  }
}
