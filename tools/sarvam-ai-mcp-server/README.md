# sarvam-ai-mcp-server

MCP server wrapping Sarvam AI's Translation REST API as a single tool, `sarvam_translate`.

Two entrypoints share the same tool logic (`tool.ts`):

- `index.ts` — stdio transport, for local use with the MCP Inspector or a desktop MCP client.
- `http.ts` — Streamable HTTP transport, for a remote/cloud-hosted server reachable over HTTPS. Protected by a bearer token (`MCP_AUTH_TOKEN`) — every request must send `Authorization: Bearer <token>`.

## Local development (stdio)

```bash
npm install
npm run build
SARVAM_API_KEY=your-key npm run inspector
```

The Inspector's web UI does not inherit your shell's environment automatically — if you're launching it manually rather than via `npm run inspector`, pass the key explicitly:

```bash
npx @modelcontextprotocol/inspector -e "SARVAM_API_KEY=your-key" node dist/index.js
```

## Local development (HTTP)

```bash
npm run build
SARVAM_API_KEY=your-key MCP_AUTH_TOKEN=$(openssl rand -hex 32) npm run start:http
```

Test it with the Inspector CLI:

```bash
npx @modelcontextprotocol/inspector --cli --server-url http://127.0.0.1:8787/mcp --transport http \
  --header "Authorization: Bearer <your MCP_AUTH_TOKEN>" --method tools/list
```

`GET /health` is unauthenticated, for load balancer / uptime checks.

## Deploying to Amazon ECS Express Mode

AWS App Runner is closed to new customers as of April 30, 2026. `deploy/aws-ecs-express-deploy.sh`
uses **ECS Express Mode** instead (AWS's official App Runner successor — same "point at an image,
get an HTTPS URL" simplicity, built on Fargate + an internet-facing ALB). It builds the Docker image,
pushes it to ECR, stores `SARVAM_API_KEY` and `MCP_AUTH_TOKEN` in Secrets Manager (never as
plaintext), creates the two required IAM roles, and creates the Express Mode service with a
`/health` health check.

Prerequisites: AWS CLI v2 configured (`aws configure`) with permissions to manage ECR, IAM, Secrets
Manager and ECS, plus Docker running locally, plus a default VPC with public subnets in the target
region (standard on most accounts).

```bash
SARVAM_API_KEY=your-real-key AWS_REGION=eu-north-1 ./deploy/aws-ecs-express-deploy.sh
```

It prints the service's HTTPS URL (`https://<service-name>.ecs.<region>.on.aws/`) and the generated
`MCP_AUTH_TOKEN` at the end — save the token, it's needed by every client that connects. This script
handles first-time creation only; redeploying after a code change uses
`aws ecs update-express-gateway-service` (check the exact flags against AWS's docs before running it
against the live service).

To verify the deployed server from anywhere:

```bash
npx @modelcontextprotocol/inspector --cli --server-url https://<service-url>/mcp --transport http \
  --header "Authorization: Bearer <token>" --method tools/list
```
