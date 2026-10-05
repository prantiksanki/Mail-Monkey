/**
 * Runs before every integration test file.
 * Prisma throws at import time if DATABASE_URL is absent — set a dummy URL so
 * the module loads cleanly. The describe.skip guard in each test file prevents
 * any actual queries from running when the real DB is unavailable.
 */
if (!process.env.DATABASE_URL) {
	process.env.DATABASE_URL =
		"postgresql://skip:skip@localhost:5432/skip-no-db";
}
