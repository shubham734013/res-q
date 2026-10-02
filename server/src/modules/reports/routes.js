/**
 * ResQ — data-quality reporting.
 * POST /api/v1/reports                (anyone, signed in or not)
 * GET  /api/v1/admin/reports          (SUPER_ADMIN)
 * PATCH /api/v1/admin/reports/:id     (SUPER_ADMIN)
 */

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  AdminReportsQuery,
  CreateReportRequest,
  ReportIdParam,
  UpdateReportRequest,
} from '../../contracts/index.js';
import { validateBody, validateParams, validateQuery } from '../../middleware/validate.js';
import { optionalAuth, requireAuth, requireRole } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/error.js';
import { getPrisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';

export const reportRouter = Router();
export const adminReportRouter = Router();

/** Anonymous writes need a tighter limit than authenticated ones. */
const reportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({
      success: false,
      error: { code: 'RATE_LIMITED', message: 'Too many reports submitted. Try again later.' },
      requestId: req.id,
    }),
});

const serializeAdminReport = (r) => ({
  id: r.id,
  facility: { id: r.facility.id, name: r.facility.name, city: r.facility.city },
  category: r.category,
  description: r.description,
  status: r.status,
  // Reporter identity is reduced to a boolean — an admin triaging a data issue
  // has no need for the reporter's name or email.
  isAnonymous: r.reporterId == null,
  createdAt: r.createdAt.toISOString(),
  resolvedAt: r.resolvedAt ? r.resolvedAt.toISOString() : null,
  resolutionNote: r.resolutionNote ?? null,
});

reportRouter.post(
  '/',
  reportLimiter,
  optionalAuth,
  validateBody(CreateReportRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();

    const facility = await prisma.facility.findFirst({
      where: { id: req.body.facilityId, deletedAt: null },
      select: { id: true },
    });
    if (!facility) throw ApiError.facilityNotFound();

    const report = await prisma.report.create({
      data: {
        facilityId: req.body.facilityId,
        category: req.body.category,
        description: req.body.description,
        reporterId: req.user?.id ?? null,
      },
    });

    res.status(201).json({
      success: true,
      data: {
        id: report.id,
        status: report.status,
        createdAt: report.createdAt.toISOString(),
      },
    });
  }),
);

adminReportRouter.get(
  '/reports',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validateQuery(AdminReportsQuery),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const q = req.validatedQuery;

    const where = {
      ...(q.status && { status: q.status }),
      ...(q.category && { category: q.category }),
      ...(q.facilityId && { facilityId: q.facilityId }),
    };

    const [total, rows] = await Promise.all([
      prisma.report.count({ where }),
      prisma.report.findMany({
        where,
        include: { facility: { select: { id: true, name: true, city: true } } },
        orderBy: { createdAt: q.sort === 'OLDEST' ? 'asc' : 'desc' },
        skip: (q.page - 1) * q.limit,
        take: q.limit,
      }),
    ]);

    res.json({
      success: true,
      data: {
        items: rows.map(serializeAdminReport),
        pagination: {
          page: q.page,
          limit: q.limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / q.limit)),
          hasNext: q.page * q.limit < total,
        },
      },
    });
  }),
);

adminReportRouter.patch(
  '/reports/:id',
  requireAuth,
  requireRole('SUPER_ADMIN'),
  validateParams(ReportIdParam),
  validateBody(UpdateReportRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const id = req.validatedParams.id;
    const terminal = req.body.status === 'RESOLVED' || req.body.status === 'DISMISSED';

    const existing = await prisma.report.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw ApiError.notFound('Report not found.');

    const report = await prisma.report.update({
      where: { id },
      data: {
        ...req.body,
        ...(terminal && { resolvedById: req.user.id, resolvedAt: new Date() }),
      },
      include: { facility: { select: { id: true, name: true, city: true } } },
    });

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'REPORT_UPDATED',
        entityType: 'Report',
        entityId: id,
        metadata: { status: report.status },
        requestId: req.id,
      },
    });

    res.json({ success: true, data: { report: serializeAdminReport(report) } });
  }),
);
