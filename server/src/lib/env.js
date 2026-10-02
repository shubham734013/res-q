/**
 * ResQ — environment configuration.
 *
 * Validated once at boot with the same Zod we use on requests, so a missing or
 * malformed variable fails loudly on startup rather than at 2am inside a
 * request handler.
 */

import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),

  /** Access tokens stay short-lived; the refresh token carries the session. */
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),

  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  /** How long an emergency session's precise coordinates are retained. */
  EMERGENCY_SESSION_TTL_MINUTES: z.coerce.number().int().positive().default(240),

  /**
   * Flags this deployment as showing seeded data. The seed script sets every
   * record's sourceType to DEMO regardless; this drives the global banner.
   */
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const lines = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  console.error('Invalid environment configuration:\n' + lines.join('\n'));
  console.error('\nCopy .env.example to .env and fill it in.');
  process.exit(1);
}

export const env = parsed.data;
export const isProduction = env.NODE_ENV === 'production';
