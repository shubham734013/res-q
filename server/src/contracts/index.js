/**
 * ResQ — contract barrel.
 *
 * Import request schemas in route definitions (to validate params/query/body),
 * and response schemas in contract tests. Validating responses in production is
 * optional; validating them in tests is not — that is what stops a serializer
 * quietly dropping provenance.
 */

export * from './common.js';
export * from './auth.js';
export * from './facility.js';
export * from './emergency.js';
export * from './reports.js';
export * from './hospitalAdmin.js';
