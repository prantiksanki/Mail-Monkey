// Connectivity + pgvector check for the Supabase AI DB.
// Run: node scripts/supabase-init.cjs
const fs = require("node:fs");
const path = require("node:path");
const { Client } = require(
	path.join(__dirname, "..", "node_modules/.pnpm/pg@8.16.3/node_modules/pg"),
);

const env = fs.readFileSync(path.join(__dirname, "..", ".env"), "utf8");
const url = env.match(/^SUPABASE_DATABASE_URL="([^"]+)"/m)?.[1];
if (!url) {
	console.error("SUPABASE_DATABASE_URL not found in .env");
	process.exit(1);
}

(async () => {
	const c = new Client({
		connectionString: url,
		ssl: { rejectUnauthorized: false },
		connectionTimeoutMillis: 15000,
	});
	await c.connect();
	const v = await c.query("select version()");
	console.log("Connected OK.");
	console.log(v.rows[0].version.split(",")[0]);

	const avail = await c.query(
		"select installed_version from pg_available_extensions where name = 'vector'",
	);
	console.log(
		"pgvector available:",
		avail.rows[0]?.installed_version ?? "not-installed-yet",
	);

	await c.query("create extension if not exists vector");
	const on = await c.query(
		"select extversion from pg_extension where extname = 'vector'",
	);
	console.log(
		"pgvector enabled version:",
		on.rows[0]?.extversion ?? "FAILED",
	);

	await c.end();
})().catch((e) => {
	console.error("Error:", e.message);
	process.exit(1);
});
