// Applies scripts/supabase-schema.sql to the Supabase AI DB.
// Run: node scripts/supabase-migrate.cjs
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
const sql = fs.readFileSync(
	path.join(__dirname, "supabase-schema.sql"),
	"utf8",
);

(async () => {
	const c = new Client({
		connectionString: url,
		ssl: { rejectUnauthorized: false },
		connectionTimeoutMillis: 15000,
	});
	await c.connect();
	await c.query(sql);
	const tables = await c.query(
		"select table_name from information_schema.tables where table_schema = 'public' order by table_name",
	);
	console.log("Tables now in public schema:");
	for (const r of tables.rows) console.log("  -", r.table_name);
	await c.end();
})().catch((e) => {
	console.error("Migration error:", e.message);
	process.exit(1);
});
