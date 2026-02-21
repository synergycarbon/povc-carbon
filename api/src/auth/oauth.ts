import { Hono } from 'hono';
import { mlDsa87 } from '@estream/pq-crypto';
import { WireClient } from '@estream/sdk-wire';
import { v4 as uuid } from 'uuid';

const oauth = new Hono();

interface ClientRecord {
  client_id: string;
  spark_identity: string;
  tier: 'public' | 'buyer' | 'auditor' | 'owner';
  allowed_scopes: string[];
}

async function lookupClient(clientId: string, clientSecret: string): Promise<ClientRecord | null> {
  const wire = new WireClient();
  try {
    const result = await wire.invoke('sc.core.api_keys.v1', 'validate_client_credentials', {
      client_id: clientId,
      client_secret: clientSecret,
    });
    return result as ClientRecord;
  } catch {
    return null;
  }
}

function base64UrlEncode(data: Uint8Array | string): string {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function mintJwt(client: ClientRecord, requestedScopes: string[]): Promise<string> {
  const scopes = requestedScopes.filter((s) => client.allowed_scopes.includes(s));
  if (scopes.length === 0) {
    throw new Error('No valid scopes in request');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ML-DSA-87', typ: 'JWT' };
  const payload = {
    sub: client.spark_identity,
    iss: 'sc.estream.dev',
    aud: 'edge.sc.estream.dev',
    iat: now,
    exp: now + 3600,
    scope: scopes.join(' '),
    tier: client.tier,
    jti: uuid(),
  };

  const headerB64 = base64UrlEncode(JSON.stringify(header));
  const payloadB64 = base64UrlEncode(JSON.stringify(payload));
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  const signature = await mlDsa87.sign(signingInput);
  const signatureB64 = base64UrlEncode(signature);

  return `${headerB64}.${payloadB64}.${signatureB64}`;
}

oauth.post('/oauth/token', async (c) => {
  const contentType = c.req.header('content-type') ?? '';
  let grantType: string | undefined;
  let clientId: string | undefined;
  let clientSecret: string | undefined;
  let scope: string | undefined;

  if (contentType.includes('application/x-www-form-urlencoded')) {
    const body = await c.req.parseBody();
    grantType = body.grant_type as string;
    clientId = body.client_id as string;
    clientSecret = body.client_secret as string;
    scope = body.scope as string;
  } else {
    const body = await c.req.json<Record<string, string>>();
    grantType = body.grant_type;
    clientId = body.client_id;
    clientSecret = body.client_secret;
    scope = body.scope;
  }

  if (grantType !== 'client_credentials') {
    return c.json({ error: 'unsupported_grant_type', error_description: 'Only client_credentials grant type is supported' }, 400);
  }

  if (!clientId || !clientSecret) {
    return c.json({ error: 'invalid_request', error_description: 'client_id and client_secret are required' }, 400);
  }

  const client = await lookupClient(clientId, clientSecret);
  if (!client) {
    return c.json({ error: 'invalid_client', error_description: 'Invalid client credentials' }, 401);
  }

  const requestedScopes = scope ? scope.split(' ') : client.allowed_scopes;

  try {
    const token = await mintJwt(client, requestedScopes);
    return c.json({
      access_token: token,
      token_type: 'Bearer',
      expires_in: 3600,
      scope: requestedScopes.filter((s) => client.allowed_scopes.includes(s)).join(' '),
    });
  } catch (err) {
    return c.json({ error: 'invalid_scope', error_description: (err as Error).message }, 400);
  }
});

export { oauth };
