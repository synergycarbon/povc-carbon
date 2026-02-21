import type { Context, Next } from 'hono';
import { WireClient } from '@estream/sdk-wire';

const wire = new WireClient();

export function auditLogMiddleware() {
  return async (c: Context, next: Next) => {
    const startTime = Date.now();
    const requestId = c.get('requestId');
    const sparkIdentity = c.get('sparkIdentity') ?? 'anonymous';

    await next();

    const durationMs = Date.now() - startTime;

    wire.invoke('sc.core.audit_trail.v1', 'log_access', {
      request_id: requestId,
      actor: sparkIdentity,
      method: c.req.method,
      path: c.req.path,
      status: c.res.status,
      duration_ms: durationMs,
      ip: c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown',
      user_agent: c.req.header('user-agent') ?? 'unknown',
      timestamp: new Date().toISOString(),
    }).catch(() => {
      // Audit log failures must not block the response
    });
  };
}
