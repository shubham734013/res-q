/**
 * ResQ — Express application.
 *
 * Exported separately from server.js so tests can mount the app without
 * binding a port.
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';

import { env } from './lib/env.js';
import { requestId } from './middleware/requestId.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter, meRouter } from './modules/auth/routes.js';
import { facilityRouter } from './modules/facility/routes.js';
import { emergencyRouter } from './modules/emergency/routes.js';
import { adminReportRouter, reportRouter } from './modules/reports/routes.js';
import { hospitalAdminRouter } from './modules/hospitalAdmin/routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      // Required for the HttpOnly refresh cookie to survive a cross-origin
      // dev setup (Vite on 5173, API on 4000).
      credentials: true,
    }),
  );

  // Request size limit — TDD §14.1.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(requestId);

  app.use(
    rateLimit({
      windowMs: 60 * 1000,
      limit: 300,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      handler: (req, res) =>
        res.status(429).json({
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
          requestId: req.id,
        }),
    }),
  );

  app.get('/health', (_req, res) =>
    res.json({ success: true, data: { status: 'ok', demoMode: env.DEMO_MODE } }),
  );

  const v1 = express.Router();
  v1.use('/auth', authRouter);
  v1.use('/me', meRouter);
  v1.use('/emergency', emergencyRouter);
  v1.use('/reports', reportRouter);
  v1.use('/admin', adminReportRouter);
  v1.use('/hospital-admin', hospitalAdminRouter);
  v1.use('/', facilityRouter);

  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
