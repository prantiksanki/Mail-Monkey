import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vitest/config";

// Load root .env so DATABASE_URL is available without requiring the caller to
// set it manually. Only sets keys that aren't already in the environment.
function loadRootEnv(): Record<string, string> {
	const envPath = resolve(__dirname, "../../.env");
	if (!existsSync(envPath)) {
		return {};
	}
	const vars: Record<string, string> = {};
	for (const line of readFileSync(envPath, "utf8").split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}
		const eq = trimmed.indexOf("=");
		if (eq === -1) {
			continue;
		}
		const key = trimmed.slice(0, eq).trim();
		let value = trimmed.slice(eq + 1).trim();
		if (
			(value.startsWith('"') && value.endsWith('"')) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}
		if (!(key in process.env)) {
			vars[key] = value;
		}
	}
	return vars;
}

export default defineConfig({
	test: {
		environment: "node",
		globals: true,
		include: ["**/*.integration.test.ts"],
		setupFiles: ["./test-helpers/integration-setup.ts"],
		// Real DB — run serially to avoid connection pool exhaustion.
		// Vitest 4 removed the nested `forks: { singleFork }` pool-options
		// object; `fileParallelism: false` is the replacement (it forces
		// maxWorkers to 1), still under the default `forks` pool.
		pool: "forks",
		fileParallelism: false,
		env: loadRootEnv(),
	},
});
