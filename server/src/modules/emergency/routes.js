/**
 * ResQ — Emergency Mode routes.
 * Mounted at /api/v1/emergency
 *
 * Session creation is intentionally open to anonymous callers. Requiring a
 * login during an emergency would be indefensible.
 */

import { Router } from 'express';
import {
  CreateEmergencyContactRequest,
  CreateEmergencySessionRequest,
  EmergencyContactIdParam,
  EmergencySessionIdParam,
  SAFETY_COPY,
  ShareLocationRequest,
  UpdateEmergencyContactRequest,
  UpdateEmergencySessionRequest,
} from '../../contracts/index.js';
import { validateBody, validateParams } from '../../middleware/validate.js';
import { optionalAuth, requireAuth } from '../../middleware/auth.js';
import { asyncHandler } from '../../middleware/error.js';
import { getPrisma } from '../../lib/prisma.js';
import { ApiError } from '../../lib/errors.js';
import { env } from '../../lib/env.js';
import { searchNearby } from '../facility/service.js';

export const emergencyRouter = Router();

const serializeSession = (s) => ({
  id: s.id,
  status: s.status,
  latitude: Number(s.latitude),
  longitude: Number(s.longitude),
  selectedFacilityId: s.selectedFacilityId ?? null,
  startedAt: s.startedAt.toISOString(),
  endedAt: s.endedAt ? s.endedAt.toISOString() : null,
  expiresAt: s.expiresAt.toISOString(),
});

const serializeContact = (c) => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  relationship: c.relationship ?? null,
  priority: c.priority,
  createdAt: c.createdAt.toISOString(),
});

emergencyRouter.post(
  '/sessions',
  optionalAuth,
  validateBody(CreateEmergencySessionRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const { latitude, longitude, radiusKm, locationIsManual } = req.body;

    const session = await prisma.emergencySession.create({
      data: {
        userId: req.user?.id ?? null,
        latitude,
        longitude,
        expiresAt: new Date(Date.now() + env.EMERGENCY_SESSION_TTL_MINUTES * 60 * 1000),
      },
    });

    // Emergency ranking, not plain distance ordering.
    const result = await searchNearby(
      { lat: latitude, lng: longitude, radiusKm, page: 1, limit: 10, sort: 'RELEVANCE' },
      { emergencyMode: true },
    );

    const availabilityStale = result.items.every((f) =>
      f.availability.every(
        (a) => a.freshnessStatus === 'STALE' || a.freshnessStatus === 'UNKNOWN',
      ),
    );

    res.status(201).json({
      success: true,
      data: {
        session: serializeSession(session),
        facilities: result.items,
        degraded: {
          // The server cannot know whether the client's map tiles loaded; the
          // client flips this locally. Reported as false here so the shape is
          // always complete.
          mapUnavailable: false,
          usingManualLocation: locationIsManual,
          availabilityStale,
        },
        safetyNotice: SAFETY_COPY.emergency,
        containsDemoData: result.containsDemoData,
      },
    });
  }),
);

emergencyRouter.patch(
  '/sessions/:id',
  optionalAuth,
  validateParams(EmergencySessionIdParam),
  validateBody(UpdateEmergencySessionRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const id = req.validatedParams.id;

    const existing = await prisma.emergencySession.findUnique({ where: { id } });
    if (!existing) throw ApiError.notFound('Emergency session not found.');

    // An anonymous session (userId null) may be updated by whoever holds the
    // unguessable id. A session that belongs to an account may not be touched
    // by a different account.
    if (existing.userId && existing.userId !== req.user?.id) {
      throw ApiError.forbidden('This emergency session belongs to another account.');
    }

    const terminal = req.body.status === 'COMPLETED' || req.body.status === 'ABANDONED';

    const session = await prisma.emergencySession.update({
      where: { id },
      data: {
        ...(req.body.status && { status: req.body.status }),
        ...(req.body.selectedFacilityId !== undefined && {
          selectedFacilityId: req.body.selectedFacilityId,
        }),
        ...(terminal && { endedAt: new Date() }),
      },
    });

    // Note: selecting a facility records intent only. Nothing here implies the
    // facility has accepted the patient.
    res.json({ success: true, data: { session: serializeSession(session) } });
  }),
);

// ---------------------------------------------------------------------------
// Emergency contacts
// ---------------------------------------------------------------------------

emergencyRouter.get(
  '/contacts',
  requireAuth,
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const contacts = await prisma.emergencyContact.findMany({
      where: { userId: req.user.id },
      orderBy: [{ priority: 'asc' }, { createdAt: 'asc' }],
    });
    res.json({ success: true, data: { contacts: contacts.map(serializeContact) } });
  }),
);

emergencyRouter.post(
  '/contacts',
  requireAuth,
  validateBody(CreateEmergencyContactRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const contact = await prisma.emergencyContact.create({
      data: { ...req.body, relationship: req.body.relationship ?? null, userId: req.user.id },
    });
    res.status(201).json({ success: true, data: { contact: serializeContact(contact) } });
  }),
);

emergencyRouter.patch(
  '/contacts/:id',
  requireAuth,
  validateParams(EmergencyContactIdParam),
  validateBody(UpdateEmergencyContactRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    // updateMany scoped by userId, so one user cannot edit another's contact
    // by guessing an id.
    const result = await prisma.emergencyContact.updateMany({
      where: { id: req.validatedParams.id, userId: req.user.id },
      data: req.body,
    });
    if (result.count === 0) throw ApiError.notFound('Emergency contact not found.');

    const contact = await prisma.emergencyContact.findUnique({
      where: { id: req.validatedParams.id },
    });
    res.json({ success: true, data: { contact: serializeContact(contact) } });
  }),
);

emergencyRouter.delete(
  '/contacts/:id',
  requireAuth,
  validateParams(EmergencyContactIdParam),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    await prisma.emergencyContact.deleteMany({
      where: { id: req.validatedParams.id, userId: req.user.id },
    });
    res.json({ success: true, data: { id: req.validatedParams.id } });
  }),
);

// ---------------------------------------------------------------------------
// Location sharing
// ---------------------------------------------------------------------------

emergencyRouter.post(
  '/share',
  requireAuth,
  validateBody(ShareLocationRequest),
  asyncHandler(async (req, res) => {
    const prisma = await getPrisma();
    const { sessionId, contactIds } = req.body;

    const session = await prisma.emergencySession.findUnique({ where: { id: sessionId } });
    if (!session) throw ApiError.notFound('Emergency session not found.');
    if (session.userId && session.userId !== req.user.id) {
      throw ApiError.forbidden('This emergency session belongs to another account.');
    }

    const contacts = await prisma.emergencyContact.findMany({
      where: { id: { in: contactIds }, userId: req.user.id },
    });
    const found = new Set(contacts.map((c) => c.id));

    // No SMS/email provider is configured in the prototype, so nothing is
    // actually sent. This reports queued-not-delivered rather than claiming a
    // delivery that did not happen (TDD §15.3).
    const queued = contacts.map((c) => ({ contactId: c.id, channel: 'SMS' }));
    const failed = contactIds
      .filter((id) => !found.has(id))
      .map((id) => ({ contactId: id, reason: 'Contact not found for this account.' }));

    await prisma.auditLog.create({
      data: {
        actorId: req.user.id,
        action: 'EMERGENCY_LOCATION_SHARED',
        entityType: 'EmergencySession',
        entityId: sessionId,
        metadata: { contactCount: queued.length },
        requestId: req.id,
      },
    });

    res.json({
      success: true,
      data: { queued, failed, deliveryDisclaimer: SAFETY_COPY.notification },
    });
  }),
);
