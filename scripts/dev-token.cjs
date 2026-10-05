// Dev helper: prints a valid Zeromail session token for the mobile app's
// temporary DEV_TOKEN login. Run: node scripts/dev-token.cjs
// This reads YOUR local DB and prints YOUR own session token.
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require(
	path.join(__dirname, "..", "node_modules/.pnpm/pg@8.16.3/node_modules/pg"),
);

const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
// Match the active (uncommented) DATABASE_URL line, skipping "# ..." lines.
const url = env.match(/^DATABASE_URL="([^"]+)"/m)?.[1];
if (!url) {
	console.error("DATABASE_URL not found in .env");
	process.exit(1);
}

(async () => {
	const c = new Client({ connectionString: url });
	await c.connect();
	const r = await c.query(
		'SELECT s.token, u.email, s."expiresAt" FROM session s JOIN "user" u ON u.id = s."userId" WHERE s."expiresAt" > now() ORDER BY s."expiresAt" DESC LIMIT 5',
	);
	if (!r.rows.length) {
		console.log("No active sessions. Log into the Zeromail web app first.");
	} else {
		console.log("\nActive sessions (newest first):\n");
		for (const row of r.rows) {
			console.log(`  email:   ${row.email}`);
			console.log(`  token:   ${row.token}`);
			console.log(`  expires: ${row.expiresAt}\n`);
		}
		console.log(
			"Copy the token for your account into apps/mobile/constants/config.ts → DEV_TOKEN\n",
		);
	}
	await c.end();
})().catch((e) => {
	console.error("Error:", e.message);
	process.exit(1);
});
