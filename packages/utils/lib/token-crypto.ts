import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const KEY_LENGTH = 32;

let cachedKey: Buffer | null = null;

// OAUTH_TOKEN_ENCRYPTION_KEY is a base64-encoded 32-byte key, e.g. generated
// with `openssl rand -base64 32`. Cached after first successful parse since
// env vars don't change at runtime and this is called on every token
// read/write.
function getKey(): Buffer {
	if (cachedKey) {
		return cachedKey;
	}
	const raw = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
	if (!raw) {
		throw new Error("OAUTH_TOKEN_ENCRYPTION_KEY is not set");
	}
	const key = Buffer.from(raw, "base64");
	if (key.length !== KEY_LENGTH) {
		throw new Error(
			`OAUTH_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH} bytes, got ${key.length}`,
		);
	}
	cachedKey = key;
	return key;
}

/**
 * Encrypts a token for storage (AES-256-GCM, random IV per call).
 * Stored format: `<iv>:<authTag>:<ciphertext>`, each base64. `null`/`undefined`
 * pass through unchanged since OAuth token columns are nullable.
 */
export function encryptToken(plaintext: string): string;
export function encryptToken(
	plaintext: string | null | undefined,
): string | null;
export function encryptToken(
	plaintext: string | null | undefined,
): string | null {
	if (plaintext === null || plaintext === undefined) {
		return null;
	}
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, getKey(), iv);
	const ciphertext = Buffer.concat([
		cipher.update(plaintext, "utf8"),
		cipher.final(),
	]);
	const authTag = cipher.getAuthTag();
	return [
		iv.toString("base64"),
		authTag.toString("base64"),
		ciphertext.toString("base64"),
	].join(":");
}

/**
 * Decrypts a token stored by `encryptToken`. GCM authenticates the ciphertext
 * before any plaintext is returned, so a tampered value or wrong key throws a
 * single generic error rather than leaking a byte-by-byte validity oracle
 * (the property that makes classic CBC padding-oracle attacks possible).
 * `null`/`undefined` pass through unchanged.
 */
export function decryptToken(stored: string): string;
export function decryptToken(stored: string | null | undefined): string | null;
export function decryptToken(stored: string | null | undefined): string | null {
	if (stored === null || stored === undefined) {
		return null;
	}
	const parts = stored.split(":");
	if (parts.length !== 3) {
		throw new Error("Invalid encrypted token format");
	}
	const [ivB64, authTagB64, ciphertextB64] = parts;
	const iv = Buffer.from(ivB64, "base64");
	const authTag = Buffer.from(authTagB64, "base64");
	const ciphertext = Buffer.from(ciphertextB64, "base64");
	const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
	decipher.setAuthTag(authTag);
	const plaintext = Buffer.concat([
		decipher.update(ciphertext),
		decipher.final(),
	]);
	return plaintext.toString("utf8");
}

/** True if `value` looks like output from `encryptToken` (three base64 segments). */
export function isEncryptedToken(value: string): boolean {
	const parts = value.split(":");
	if (parts.length !== 3) {
		return false;
	}
	return parts.every((part) => /^[A-Za-z0-9+/]*={0,2}$/.test(part));
}
