/**
 * ResQ — API service layer.
 *
 * Components never call fetch directly; they call these. Every endpoint the
 * client uses is named here once, so a route change on the server is a
 * one-line change in the client.
 */

import { api, qs } from '../api/client.js';

export const authService = {
  register: (payload) => api.post('/auth/register', payload, { auth: false }),
  login: (payload) => api.post('/auth/login', payload, { auth: false }),
  logout: (allDevices = false) => api.post('/auth/logout', { allDevices }, { auth: false }),
  me: () => api.get('/me'),
  updateMe: (payload) => api.patch('/me', payload),
};

export const facilityService = {
  meta: () => api.get('/facilities/meta'),
  nearby: (params) => api.get(`/facilities/nearby${qs(params)}`, { auth: false }),
  detail: (id, origin) =>
    api.get(`/facilities/${id}${qs({ lat: origin?.lat, lng: origin?.lng })}`, { auth: false }),
  availability: (id) => api.get(`/facilities/${id}/availability`, { auth: false }),
  saved: () => api.get('/saved/facilities'),
  save: (id) => api.post(`/saved/facilities/${id}`),
  unsave: (id) => api.del(`/saved/facilities/${id}`),
};

export const emergencyService = {
  startSession: (payload) => api.post('/emergency/sessions', payload, { auth: false }),
  updateSession: (id, payload) => api.patch(`/emergency/sessions/${id}`, payload, { auth: false }),
  contacts: () => api.get('/emergency/contacts'),
  createContact: (payload) => api.post('/emergency/contacts', payload),
  updateContact: (id, payload) => api.patch(`/emergency/contacts/${id}`, payload),
  deleteContact: (id) => api.del(`/emergency/contacts/${id}`),
  shareLocation: (payload) => api.post('/emergency/share', payload),
};

export const reportService = {
  create: (payload) => api.post('/reports', payload, { auth: false }),
  adminList: (params) => api.get(`/admin/reports${qs(params)}`),
  adminUpdate: (id, payload) => api.patch(`/admin/reports/${id}`, payload),
};

export const hospitalAdminService = {
  facility: (facilityId) => api.get(`/hospital-admin/facility${qs({ facilityId })}`),
  updateFacility: (payload) => api.patch('/hospital-admin/facility', payload),
  updateAvailability: (payload) => api.patch('/hospital-admin/availability', payload),
};
