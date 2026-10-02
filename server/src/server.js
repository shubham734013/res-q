/**
 * ResQ — HTTP entry point.
 */

import { createApp } from './app.js';
import { env } from './lib/env.js';
import { disconnectPrisma, getPrisma } from './lib/prisma.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`ResQ API listening on http://localhost:${env.PORT}`);
  console.log(`CORS origin: ${env.FRONTEND_URL}`);
  if (env.DEMO_MODE) console.log('DEMO MODE: seeded data is labelled DEMO in every response.');
});

// Fail fast and loudly if the database is unreachable, rather than letting the
// first user request be the thing that discovers it.
getPrisma()
  .then((prisma) => prisma.$queryRaw`SELECT 1`)
  .then(() => console.log('Database connection OK'))
  .catch((err) => {
    console.error('\nDatabase check failed:', err.message);
    console.error('The API is running but every data route will fail until this is fixed.\n');
  });

const shutdown = async (signal) => {
  console.log(`\n${signal} received, shutting down.`);
  server.close(async () => {
    await disconnectPrisma();
    process.exit(0);
  });
  // Don't hang forever on a stuck connection.
  setTimeout(() => process.exit(1), 10000).unref();
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
