/**
 * ResQ — reporting contracts.
 * POST  /api/v1/reports
 * GET   /api/v1/admin/reports
 * PATCH /api/v1/admin/reports/:id
 */

import { z } from 'zod';
import {
  IsoDateTime,
  PaginationQuery,
  ReportCategory,
  ReportStatus,
  Uuid,
  paginated,
  successResponse,
} from './common.js';

// ---------------------------------------------------------------------------
// POST /reports  (auth optional — anonymous reports are allowed)
// ---------------------------------------------------------------------------

export const CreateReportRequest = z.object({
  facilityId: Uuid,
  category: ReportCategory,
  description: z.string().min(10).max(2000).trim(),
});

export const CreateReportResponse = successResponse(
  z.object({ id: Uuid, status: ReportStatus, createdAt: IsoDateTime }),
);

// ---------------------------------------------------------------------------
// GET /admin/reports  (SUPER_ADMIN)
// ---------------------------------------------------------------------------

export const AdminReportsQuery = PaginationQuery.extend({
  status: ReportStatus.optional(),
  category: ReportCategory.optional(),
  facilityId: Uuid.optional(),
  sort: z.enum(['NEWEST', 'OLDEST']).default('NEWEST'),
});

export const AdminReportItem = z.object({
  id: Uuid,
  facility: z.object({ id: Uuid, name: z.string(), city: z.string() }),
  category: ReportCategory,
  description: z.string(),
  status: ReportStatus,
  /**
   * Reporter identity is reduced to a boolean. An admin triaging a data-quality
   * report has no need for the reporter's name or email, and exposing it in a
   * list endpoint is a needless PII leak.
   */
  isAnonymous: z.boolean(),
  createdAt: IsoDateTime,
  resolvedAt: IsoDateTime.nullable(),
  resolutionNote: z.string().nullable(),
});

export const AdminReportsResponse = successResponse(paginated(AdminReportItem));

// ---------------------------------------------------------------------------
// PATCH /admin/reports/:id
// ---------------------------------------------------------------------------

export const ReportIdParam = z.object({ id: Uuid });

export const UpdateReportRequest = z
  .object({
    status: ReportStatus,
    resolutionNote: z.string().max(2000).trim(),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, 'At least one field must be provided')
  .refine(
    (v) =>
      !(v.status === 'RESOLVED' || v.status === 'DISMISSED') ||
      (v.resolutionNote != null && v.resolutionNote.length > 0),
    {
      path: ['resolutionNote'],
      message: 'A resolution note is required when resolving or dismissing a report',
    },
  );

export const UpdateReportResponse = successResponse(z.object({ report: AdminReportItem }));
