import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import { authMiddleware } from './auth/middleware.js';
import { oauth } from './auth/oauth.js';
import { requestIdMiddleware } from './middleware/request-id.js';
import { rateLimitMiddleware } from './middleware/rate-limit.js';
import { auditLogMiddleware } from './middleware/audit-log.js';
import { errorHandler } from './middleware/error-handler.js';
import { credits } from './routes/credits.js';
import { attestations } from './routes/attestations.js';
import { retirements } from './routes/retirements.js';
import { marketplace } from './routes/marketplace.js';
import { contracts } from './routes/contracts.js';
import { audit } from './routes/audit.js';
import { governance } from './routes/governance.js';

const app = new Hono();

// Global error handler
app.onError(errorHandler);

// CORS for B2B integrations
app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id', 'X-Api-Key'],
  exposeHeaders: ['X-Request-Id', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
}));

// Request ID on every request
app.use('*', requestIdMiddleware());

// Health check (unauthenticated)
app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.0' }));

// OAuth2 token endpoint (unauthenticated)
app.route('/', oauth);

// All /api/v1/* routes require auth
app.use('/api/v1/*', authMiddleware());
app.use('/api/v1/*', rateLimitMiddleware({ maxRequests: 100, windowMs: 1000 }));
app.use('/api/v1/*', auditLogMiddleware());

// Mount route handlers
app.route('/api/v1/credits', credits);
app.route('/api/v1/attestations', attestations);
app.route('/api/v1/retirements', retirements);
app.route('/api/v1/marketplace', marketplace);
app.route('/api/v1/contracts', contracts);
app.route('/api/v1/audit', audit);
app.route('/api/v1/governance', governance);

// 404 for unmatched routes
app.notFound((c) => {
  return c.json({
    error: {
      code: 'not_found',
      message: `No route matches ${c.req.method} ${c.req.path}`,
      request_id: c.get('requestId') ?? 'unknown',
    },
  }, 404);
});

const port = parseInt(process.env.PORT ?? '8080', 10);

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`SynergyCarbon B2B API listening on port ${info.port}`);
  console.log(`Health: http://localhost:${info.port}/health`);
  console.log(`API:    http://localhost:${info.port}/api/v1/`);
});

export { app };
