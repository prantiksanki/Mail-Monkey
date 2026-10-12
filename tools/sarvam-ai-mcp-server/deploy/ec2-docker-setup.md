# EC2 Docker setup — popsuites-staging-app

Target: `i-0401f517d2bf50d2b` (`popsuites-staging-app`), `3.111.57.198`, ap-south-1, Amazon Linux 2023.

## Prerequisites (done via AWS CLI already)

- Secrets stored in Secrets Manager (ap-south-1):
  - `sarvam-ai-mcp-server/SARVAM_API_KEY`
  - `sarvam-ai-mcp-server/MCP_AUTH_TOKEN`
- IAM role `popsuites-mcp-ec2-role` created with a policy scoped to `secretsmanager:GetSecretValue` on those two secrets, in instance profile `popsuites-mcp-ec2-profile`.
- Security group `sg-021c5c5cedad03eb1` has a new rule: port 8000 open only to the CloudFront origin-facing prefix list (`pl-9aa247f3`) — not the public internet.

## Step 0 — Attach the IAM role to the instance (do this first, one-time)

```bash
aws ec2 associate-iam-instance-profile --region ap-south-1 --instance-id i-0401f517d2bf50d2b --iam-instance-profile Name=popsuites-mcp-ec2-profile
```

## Step 1 — Copy the server code to the instance (run from your own machine)

```bash
scp -i /path/to/popsuites-staging.pem -r tools/sarvam-ai-mcp-server ec2-user@3.111.57.198:~/sarvam-ai-mcp-server
```

## Step 2 — SSH in

```bash
ssh -i /path/to/popsuites-staging.pem ec2-user@3.111.57.198
```

## Step 3 — Install Docker (Amazon Linux 2023)

```bash
sudo dnf install -y docker
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user
exit
```

Then SSH back in (so the new group membership takes effect):

```bash
ssh -i /path/to/popsuites-staging.pem ec2-user@3.111.57.198
```

## Step 4 — Build and run the container

```bash
cd ~/sarvam-ai-mcp-server
docker build -t sarvam-ai-mcp-server:latest .

docker run -d \
  --name sarvam-mcp \
  --restart always \
  -p 8000:8000 \
  -e PORT=8000 \
  -e AWS_REGION=ap-south-1 \
  -e SARVAM_API_KEY_SECRET_ID=sarvam-ai-mcp-server/SARVAM_API_KEY \
  -e MCP_AUTH_TOKEN_SECRET_ID=sarvam-ai-mcp-server/MCP_AUTH_TOKEN \
  sarvam-ai-mcp-server:latest
```

No plaintext secrets are passed — the container fetches both from Secrets Manager at startup using the
instance's IAM role (this instance already has `HttpPutResponseHopLimit: 2` on its metadata options,
which is required for a container to reach the instance metadata service through Docker's network
bridge — already correctly configured).

## Step 5 — Verify

```bash
curl http://localhost:8000/health
docker logs sarvam-mcp
```

Expect `{"status":"ok"}` and a log line `Streamable HTTP MCP server listening on port 8000`.

To confirm it's *not* reachable directly from the public internet (only via CloudFront later):

```bash
# from your own machine, not the instance
curl -m 5 http://3.111.57.198:8000/health
```

This should time out / fail to connect — the security group only allows CloudFront's IPs.

## Restarting after a code change

```bash
cd ~/sarvam-ai-mcp-server
docker build -t sarvam-ai-mcp-server:latest .
docker stop sarvam-mcp && docker rm sarvam-mcp
docker run -d --name sarvam-mcp --restart always -p 8000:8000 \
  -e PORT=8000 -e AWS_REGION=ap-south-1 \
  -e SARVAM_API_KEY_SECRET_ID=sarvam-ai-mcp-server/SARVAM_API_KEY \
  -e MCP_AUTH_TOKEN_SECRET_ID=sarvam-ai-mcp-server/MCP_AUTH_TOKEN \
  sarvam-ai-mcp-server:latest
```
