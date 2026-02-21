import { mlDsa87 } from '@estream/pq-crypto';

const SIGNING_KEY_ENV = 'SC_WEBHOOK_SIGNING_KEY';

let signingKeyHex: string | null = null;

function getSigningKey(): string {
  if (!signingKeyHex) {
    signingKeyHex = process.env[SIGNING_KEY_ENV] ?? null;
    if (!signingKeyHex) {
      throw new Error(`${SIGNING_KEY_ENV} environment variable is required for webhook signing`);
    }
  }
  return signingKeyHex;
}

export async function signPayload(body: string, timestamp: string): Promise<string> {
  const key = getSigningKey();
  const message = new TextEncoder().encode(`${timestamp}.${body}`);
  const signature = await mlDsa87.sign(key, message);
  return Buffer.from(signature).toString('hex');
}

export async function verifyPayloadSignature(
  body: string,
  timestamp: string,
  signatureHex: string,
  publicKeyHex: string,
): Promise<boolean> {
  const message = new TextEncoder().encode(`${timestamp}.${body}`);
  const signature = Buffer.from(signatureHex, 'hex');
  return mlDsa87.verify(publicKeyHex, message, signature);
}
