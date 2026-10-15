const ALGORITHM = "AES-GCM";

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

async function masterKey(): Promise<CryptoKey> {
  const raw = process.env.SECRETS_MASTER_KEY;
  if (!raw) throw new Error("SECRETS_MASTER_KEY is not set on this deployment");
  const bytes = fromBase64(raw);
  if (bytes.length !== 32) {
    throw new Error("SECRETS_MASTER_KEY must be 32 bytes, base64 encoded");
  }
  return crypto.subtle.importKey("raw", bytes, ALGORITHM, false, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encrypt(
  plaintext: string,
): Promise<{ ciphertext: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    await masterKey(),
    new TextEncoder().encode(plaintext),
  );
  return { ciphertext: toBase64(new Uint8Array(encrypted)), iv: toBase64(iv) };
}

export async function decrypt(ciphertext: string, iv: string): Promise<string> {
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv: fromBase64(iv) },
    await masterKey(),
    fromBase64(ciphertext),
  );
  return new TextDecoder().decode(decrypted);
}
