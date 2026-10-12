import { promises as dns } from "node:dns";
import { db } from "@repo/database";
import { decryptToken, encryptToken } from "@repo/utils/lib/token-crypto";
import { ImapFlow } from "imapflow";
import nodemailer, { type Transporter } from "nodemailer";

export interface ImapCredentials {
	imapHost: string;
	imapPort: number;
	imapSecure: boolean;
	smtpHost: string;
	smtpPort: number;
	smtpSecure: boolean;
	username: string;
	password: string;
}

/**
 * Manual IMAP/SMTP connection details entered by the user in the connect
 * form — same shape as {@link ImapCredentials} but with a plaintext password,
 * used before anything is persisted (the connect procedure verifies these
 * work, then encrypts the password for storage).
 */
export type ImapConnectionInput = ImapCredentials;

export async function getImapCredentials(
	accountId: string,
): Promise<ImapCredentials> {
	const account = await db.account.findUnique({ where: { id: accountId } });
	if (
		!account ||
		!account.imapHost ||
		!account.imapPort ||
		!account.smtpHost ||
		!account.smtpPort ||
		!account.imapPasswordEncrypted
	) {
		throw new Error(
			`IMAP account ${accountId} is missing connection details — reconnect the mailbox.`,
		);
	}
	const password = decryptToken(account.imapPasswordEncrypted);
	if (!password) {
		throw new Error(`IMAP account ${accountId} has no stored password.`);
	}
	return {
		imapHost: account.imapHost,
		imapPort: account.imapPort,
		imapSecure: account.imapSecure ?? true,
		smtpHost: account.smtpHost,
		smtpPort: account.smtpPort,
		smtpSecure: account.smtpSecure ?? true,
		username: account.accountId,
		password,
	};
}

export function encryptImapPassword(plaintext: string): string {
	// biome-ignore lint/style/noNonNullAssertion: encryptToken(string) overload never returns null
	return encryptToken(plaintext)!;
}

/**
 * Opens an authenticated IMAP connection, runs `fn`, and always logs out —
 * mirrors the try/finally shape of a DB transaction so callers never leak a
 * connection on error. ImapFlow connections are single-use per call rather
 * than pooled: this is a low-traffic, poll-based integration (see
 * imap-sync-poller.ts), so connection setup cost is traded for simplicity.
 */
export async function withImapConnection<T>(
	accountId: string,
	fn: (client: ImapFlow, creds: ImapCredentials) => Promise<T>,
): Promise<T> {
	const creds = await getImapCredentials(accountId);
	return withImapConnectionUsing(creds, fn);
}

export async function withImapConnectionUsing<T>(
	creds: ImapCredentials,
	fn: (client: ImapFlow, creds: ImapCredentials) => Promise<T>,
): Promise<T> {
	const client = new ImapFlow({
		host: creds.imapHost,
		port: creds.imapPort,
		secure: creds.imapSecure,
		auth: { user: creds.username, pass: creds.password },
		logger: false,
	});
	await client.connect();
	try {
		return await fn(client, creds);
	} finally {
		await client.logout().catch(() => client.close());
	}
}

export function createSmtpTransport(creds: ImapCredentials): Transporter {
	return nodemailer.createTransport({
		host: creds.smtpHost,
		port: creds.smtpPort,
		secure: creds.smtpSecure,
		auth: { user: creds.username, pass: creds.password },
	});
}

const BLOCKED_HOSTNAMES = new Set(["localhost"]);

function isPrivateIPv4(ip: string): boolean {
	const parts = ip.split(".").map(Number);
	if (parts.length !== 4 || parts.some((p) => Number.isNaN(p))) {
		return false;
	}
	const [a, b] = parts;
	if (a === 127) {
		return true; // loopback
	}
	if (a === 10) {
		return true; // private
	}
	if (a === 172 && b >= 16 && b <= 31) {
		return true; // private
	}
	if (a === 192 && b === 168) {
		return true; // private
	}
	if (a === 169 && b === 254) {
		return true; // link-local, incl. cloud metadata
	}
	if (a === 100 && b >= 64 && b <= 127) {
		return true; // carrier-grade NAT
	}
	if (a === 0) {
		return true;
	}
	return false;
}

function isPrivateIPv6(ip: string): boolean {
	const lower = ip.toLowerCase();
	if (lower === "::1") {
		return true; // loopback
	}
	if (lower.startsWith("fe80:")) {
		return true; // link-local
	}
	if (lower.startsWith("fc") || lower.startsWith("fd")) {
		return true; // unique local (fc00::/7)
	}
	if (lower.startsWith("::ffff:")) {
		return isPrivateIPv4(lower.slice("::ffff:".length));
	}
	return false;
}

/**
 * Blocks the pre-signup verify check (a public, unauthenticated endpoint)
 * from being used as an SSRF probe against internal infrastructure — e.g. a
 * cloud metadata endpoint (169.254.169.254) or the container's own private
 * network. Resolves the hostname and rejects private/loopback/link-local
 * targets.
 *
 * This is a resolve-time check — a malicious DNS record could still rebind
 * to a private address after this call returns (TOCTOU), but the connection
 * this guards only ever performs an IMAP login handshake, not an
 * arbitrary/data-returning request, which caps what that gap can leak.
 */
export async function assertPublicHost(host: string): Promise<void> {
	const trimmed = host.trim().toLowerCase();
	if (!trimmed || BLOCKED_HOSTNAMES.has(trimmed)) {
		throw new Error("That host is not allowed.");
	}

	let addresses: string[];
	try {
		addresses = (await dns.lookup(trimmed, { all: true })).map(
			(r) => r.address,
		);
	} catch {
		throw new Error("Couldn't resolve that host.");
	}

	if (addresses.some((a) => isPrivateIPv4(a) || isPrivateIPv6(a))) {
		throw new Error("That host is not allowed.");
	}
}

/**
 * Live connectivity + auth check used by the connect flow before anything is
 * persisted — logging in and immediately out is the only reliable way to
 * confirm a host/port/password combination actually works, since IMAP has no
 * lighter-weight "ping" verb.
 */
export async function verifyImapConnection(
	creds: ImapConnectionInput,
): Promise<void> {
	await withImapConnectionUsing(creds, async (client) => {
		await client.mailboxOpen("INBOX", { readOnly: true });
	});
}
