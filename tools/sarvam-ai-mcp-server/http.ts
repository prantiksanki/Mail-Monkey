#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
	CallToolRequestSchema,
	ErrorCode,
	ListToolsRequestSchema,
	McpError,
} from "@modelcontextprotocol/sdk/types.js";
import express, {
	type NextFunction,
	type Request,
	type Response,
} from "express";
import { resolveSecret } from "./secrets.js";
import { callSarvamTranslate, SARVAM_TRANSLATE_TOOL } from "./tool.js";

const PORT = Number(process.env.PORT) || 8787;

function createMcpServer(sarvamApiKey: string): Server {
	const server = new Server(
		{ name: "sarvam-ai-mcp-server", version: "1.0.0" },
		{ capabilities: { tools: {} } },
	);

	server.setRequestHandler(ListToolsRequestSchema, async () => ({
		tools: [SARVAM_TRANSLATE_TOOL],
	}));

	server.setRequestHandler(CallToolRequestSchema, async (request) => {
		const { name, arguments: args } = request.params;
		if (name !== "sarvam_translate") {
			throw new McpError(
				ErrorCode.MethodNotFound,
				`Unknown tool: ${name}`,
			);
		}
		return callSarvamTranslate(args, sarvamApiKey);
	});

	return server;
}

function requireBearerAuth(mcpAuthToken: string) {
	return (req: Request, res: Response, next: NextFunction) => {
		const header = req.header("authorization") ?? "";
		const [scheme, token] = header.split(" ");

		if (scheme !== "Bearer" || token !== mcpAuthToken) {
			res.status(401).json({
				jsonrpc: "2.0",
				error: { code: -32001, message: "Unauthorized" },
				id: null,
			});
			return;
		}

		next();
	};
}

async function main() {
	const SARVAM_API_KEY = await resolveSecret(
		"SARVAM_API_KEY",
		"SARVAM_API_KEY_SECRET_ID",
	);
	const MCP_AUTH_TOKEN = await resolveSecret(
		"MCP_AUTH_TOKEN",
		"MCP_AUTH_TOKEN_SECRET_ID",
	);

	const app = express();
	app.use(express.json());

	// Unauthenticated health check for uptime monitors / load balancers.
	app.get("/health", (_req, res) => {
		res.status(200).json({ status: "ok" });
	});

	app.post("/mcp", requireBearerAuth(MCP_AUTH_TOKEN), async (req, res) => {
		// Stateless mode: a fresh Server + transport pair per request avoids
		// cross-request state and works cleanly behind autoscaled/multi-instance hosting.
		const server = createMcpServer(SARVAM_API_KEY);
		const transport = new StreamableHTTPServerTransport({
			sessionIdGenerator: undefined,
		});

		res.on("close", () => {
			transport.close();
			server.close();
		});

		try {
			await server.connect(transport);
			await transport.handleRequest(req, res, req.body);
		} catch (error) {
			console.error(
				"[sarvam-ai-mcp-server] Error handling MCP request:",
				error,
			);
			if (!res.headersSent) {
				res.status(500).json({
					jsonrpc: "2.0",
					error: { code: -32603, message: "Internal server error" },
					id: null,
				});
			}
		}
	});

	// Stateless mode does not support the GET (SSE stream) or DELETE (session
	// teardown) verbs from the Streamable HTTP spec — there is no session to
	// attach to or tear down, so return 405 rather than pretending to support them.
	app.get("/mcp", (_req, res) => {
		res.status(405).json({
			jsonrpc: "2.0",
			error: {
				code: -32000,
				message: "Method not allowed in stateless mode",
			},
			id: null,
		});
	});

	app.delete("/mcp", (_req, res) => {
		res.status(405).json({
			jsonrpc: "2.0",
			error: {
				code: -32000,
				message: "Method not allowed in stateless mode",
			},
			id: null,
		});
	});

	app.listen(PORT, () => {
		console.error(
			`[sarvam-ai-mcp-server] Streamable HTTP MCP server listening on port ${PORT} (POST /mcp, GET /health).`,
		);
	});
}

main().catch((error) => {
	console.error("[sarvam-ai-mcp-server] Fatal error during startup:", error);
	process.exit(1);
});
