#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
	CallToolRequestSchema,
	ErrorCode,
	ListToolsRequestSchema,
	McpError,
} from "@modelcontextprotocol/sdk/types.js";

import { callSarvamTranslate, SARVAM_TRANSLATE_TOOL } from "./tool.js";

const SARVAM_API_KEY = process.env.SARVAM_API_KEY;

if (!SARVAM_API_KEY) {
	console.error(
		"[sarvam-ai-mcp-server] Missing required environment variable SARVAM_API_KEY. " +
			"Set it before starting the server, e.g. SARVAM_API_KEY=your-key node index.js",
	);
	process.exit(1);
}

const server = new Server(
	{
		name: "sarvam-ai-mcp-server",
		version: "1.0.0",
	},
	{
		capabilities: {
			tools: {},
		},
	},
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
	return {
		tools: [SARVAM_TRANSLATE_TOOL],
	};
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
	const { name, arguments: args } = request.params;

	if (name !== "sarvam_translate") {
		throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
	}

	return callSarvamTranslate(args, SARVAM_API_KEY);
});

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
	console.error("[sarvam-ai-mcp-server] MCP server running on stdio.");
}

main().catch((error) => {
	console.error("[sarvam-ai-mcp-server] Fatal error:", error);
	process.exit(1);
});
