import { mlDsa87 } from '@estream/pq-crypto';
import type { JwtClaims } from '../types.js';

const JWT_ISSUER = 'sc.estream.dev';
const JWT_AUDIENCE = 'edge.sc.estream.dev';

function base64UrlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function base64UrlDecodeToString(str: string): string {
  return new TextDecoder().decode(base64UrlDecode(str));
}

export interface JwtVerifyResult {
  valid: boolean;
  claims?: JwtClaims;
  error?: string;
}

export async function verifyMlDsaJwt(token: string): Promise<JwtVerifyResult> {
  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed JWT: expected 3 parts' };
  }

  const [headerB64, payloadB64, signatureB64] = parts;

  let header: { alg: string; typ?: string };
  try {
    header = JSON.parse(base64UrlDecodeToString(headerB64));
  } catch {
    return { valid: false, error: 'Malformed JWT header' };
  }

  if (header.alg !== 'ML-DSA-87') {
    return { valid: false, error: `Unsupported algorithm: ${header.alg}` };
  }

  let claims: JwtClaims;
  try {
    claims = JSON.parse(base64UrlDecodeToString(payloadB64));
  } catch {
    return { valid: false, error: 'Malformed JWT payload' };
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.exp && claims.exp < now) {
    return { valid: false, error: 'Token expired' };
  }
  if (claims.iat && claims.iat > now + 300) {
    return { valid: false, error: 'Token issued in the future' };
  }
  if (claims.iss !== JWT_ISSUER) {
    return { valid: false, error: `Invalid issuer: ${claims.iss}` };
  }
  if (claims.aud !== JWT_AUDIENCE) {
    return { valid: false, error: `Invalid audience: ${claims.aud}` };
  }

  const signedData = new TextEncoder().encode(`${headerB64}.${payloadB64}`);
  const signature = base64UrlDecode(signatureB64);

  const verified = await mlDsa87.verify(
    claims.sub,
    signedData,
    signature,
  );

  if (!verified) {
    return { valid: false, error: 'Invalid ML-DSA-87 signature' };
  }

  return { valid: true, claims };
}
