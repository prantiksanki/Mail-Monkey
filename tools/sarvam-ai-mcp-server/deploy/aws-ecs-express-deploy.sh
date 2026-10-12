#!/usr/bin/env bash
# Deploys the sarvam-ai-mcp-server HTTP transport to Amazon ECS Express Mode
# (AWS's App Runner successor, https://docs.aws.amazon.com/AmazonECS/latest/developerguide/express-service-overview.html).
# Provisions a Fargate task behind an internet-facing ALB with automatic
# HTTPS on a *.ecs.<region>.on.aws URL. SARVAM_API_KEY and MCP_AUTH_TOKEN are
# stored in Secrets Manager and injected as container secrets — never as
# plaintext env vars.
#
# Prerequisites:
#   - AWS CLI v2 installed and configured (`aws configure`) with an IAM
#     principal that can create ECR repos, IAM roles, Secrets Manager
#     secrets, and ECS Express services.
#   - Docker installed and running.
#   - A default VPC with public subnets in the target region (standard on
#     most accounts; see the AWS docs above if yours doesn't have one).
#
# Usage:
#   SARVAM_API_KEY=your-real-key \
#   AWS_REGION=eu-north-1 \
#   ./deploy/aws-ecs-express-deploy.sh
#
# MCP_AUTH_TOKEN is generated for you if not already set, and printed at the
# end — save it, your MCP clients need it as `Authorization: Bearer <token>`.
#
# This script handles first-time creation. To redeploy after a code change,
# use `aws ecs update-express-gateway-service` (see AWS docs) — verify its
# exact flags against the docs before running it against this live service.

set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-sarvam-ai-mcp-server}"
AWS_REGION="${AWS_REGION:-eu-north-1}"
SARVAM_API_KEY="${SARVAM_API_KEY:?Set SARVAM_API_KEY to your real Sarvam AI key before running this script}"
MCP_AUTH_TOKEN="${MCP_AUTH_TOKEN:-$(openssl rand -hex 32)}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Verifying AWS credentials"
AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text --region "$AWS_REGION")"
echo "    Account: $AWS_ACCOUNT_ID  Region: $AWS_REGION"

ECR_REPO_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${SERVICE_NAME}"

echo "==> Ensuring ECR repository exists ($SERVICE_NAME)"
if ! aws ecr describe-repositories --repository-names "$SERVICE_NAME" --region "$AWS_REGION" >/dev/null 2>&1; then
  aws ecr create-repository --repository-name "$SERVICE_NAME" --region "$AWS_REGION" >/dev/null
  echo "    Created $ECR_REPO_URI"
else
  echo "    Already exists: $ECR_REPO_URI"
fi

echo "==> Building and pushing Docker image"
aws ecr get-login-password --region "$AWS_REGION" | docker login --username AWS --password-stdin "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
docker build -t "$SERVICE_NAME" "$PROJECT_DIR"
docker tag "$SERVICE_NAME:latest" "$ECR_REPO_URI:latest"
docker push "$ECR_REPO_URI:latest"

echo "==> Storing secrets in AWS Secrets Manager"
put_secret () {
  local name="$1" value="$2"
  if aws secretsmanager describe-secret --secret-id "$name" --region "$AWS_REGION" >/dev/null 2>&1; then
    aws secretsmanager put-secret-value --secret-id "$name" --secret-string "$value" --region "$AWS_REGION" >/dev/null
  else
    aws secretsmanager create-secret --name "$name" --secret-string "$value" --region "$AWS_REGION" >/dev/null
  fi
}
put_secret "${SERVICE_NAME}/SARVAM_API_KEY" "$SARVAM_API_KEY"
put_secret "${SERVICE_NAME}/MCP_AUTH_TOKEN" "$MCP_AUTH_TOKEN"
SARVAM_SECRET_ARN="$(aws secretsmanager describe-secret --secret-id "${SERVICE_NAME}/SARVAM_API_KEY" --region "$AWS_REGION" --query ARN --output text)"
AUTH_SECRET_ARN="$(aws secretsmanager describe-secret --secret-id "${SERVICE_NAME}/MCP_AUTH_TOKEN" --region "$AWS_REGION" --query ARN --output text)"
echo "    Secrets stored."

echo "==> Ensuring ECS task execution role (pulls from ECR, reads our secrets)"
EXEC_ROLE_NAME="ecsTaskExecutionRole"
if ! aws iam get-role --role-name "$EXEC_ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "$EXEC_ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ecs-tasks.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    >/dev/null
  aws iam attach-role-policy \
    --role-name "$EXEC_ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy" \
    >/dev/null
  echo "    Created $EXEC_ROLE_NAME"
  NEW_ROLE_CREATED=1
else
  echo "    Already exists: $EXEC_ROLE_NAME"
fi
EXEC_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${EXEC_ROLE_NAME}"

# Scope secret reads to just this service's two secrets (least privilege).
# Re-running this is safe: put-role-policy overwrites the same named policy.
node -e "
const policy = {
  Version: '2012-10-17',
  Statement: [{
    Effect: 'Allow',
    Action: ['secretsmanager:GetSecretValue'],
    Resource: [process.argv[1], process.argv[2]],
  }],
};
process.stdout.write(JSON.stringify(policy));
" "$SARVAM_SECRET_ARN" "$AUTH_SECRET_ARN" > /tmp/secrets-policy.json
aws iam put-role-policy \
  --role-name "$EXEC_ROLE_NAME" \
  --policy-name "${SERVICE_NAME}-secrets-access" \
  --policy-document file:///tmp/secrets-policy.json

echo "==> Ensuring ECS Express infrastructure role (manages ALB/target groups/scaling)"
INFRA_ROLE_NAME="ecsInfrastructureRoleForExpressServices"
if ! aws iam get-role --role-name "$INFRA_ROLE_NAME" >/dev/null 2>&1; then
  aws iam create-role \
    --role-name "$INFRA_ROLE_NAME" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Sid":"AllowAccessInfrastructureForECSExpressServices","Effect":"Allow","Principal":{"Service":"ecs.amazonaws.com"},"Action":"sts:AssumeRole"}]}' \
    >/dev/null
  aws iam attach-role-policy \
    --role-name "$INFRA_ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AmazonECSInfrastructureRoleforExpressGatewayServices" \
    >/dev/null
  echo "    Created $INFRA_ROLE_NAME"
  NEW_ROLE_CREATED=1
else
  echo "    Already exists: $INFRA_ROLE_NAME"
fi
INFRA_ROLE_ARN="arn:aws:iam::${AWS_ACCOUNT_ID}:role/${INFRA_ROLE_NAME}"

if [ "${NEW_ROLE_CREATED:-0}" = "1" ]; then
  echo "==> Waiting ~30s for newly created IAM roles to propagate"
  sleep 30
fi

echo "==> Building container definition"
node -e "
const config = {
  image: process.argv[1] + ':latest',
  containerPort: 8787,
  secrets: [
    { name: 'SARVAM_API_KEY', valueFrom: process.argv[2] },
    { name: 'MCP_AUTH_TOKEN', valueFrom: process.argv[3] },
  ],
};
process.stdout.write(JSON.stringify(config));
" "$ECR_REPO_URI" "$SARVAM_SECRET_ARN" "$AUTH_SECRET_ARN" > /tmp/primary-container.json

echo "==> Creating the Express Mode service (this provisions an ALB — can take several minutes)"
aws ecs create-express-gateway-service \
  --region "$AWS_REGION" \
  --service-name "$SERVICE_NAME" \
  --execution-role-arn "$EXEC_ROLE_ARN" \
  --infrastructure-role-arn "$INFRA_ROLE_ARN" \
  --primary-container file:///tmp/primary-container.json \
  --health-check-path /health \
  --cpu 1 \
  --memory 2 \
  --monitor-resources

SERVICE_ARN="arn:aws:ecs:${AWS_REGION}:${AWS_ACCOUNT_ID}:service/default/${SERVICE_NAME}"

echo ""
echo "==> Final service state:"
aws ecs describe-express-gateway-service --service-arn "$SERVICE_ARN" --region "$AWS_REGION"

echo ""
echo "=================================================================="
echo "Look for the service URL above (format: https://<service-name>.ecs.${AWS_REGION}.on.aws/)"
echo "MCP endpoint will be that URL + /mcp, e.g. https://${SERVICE_NAME}.ecs.${AWS_REGION}.on.aws/mcp"
echo "MCP_AUTH_TOKEN: ${MCP_AUTH_TOKEN}"
echo "(save that token — it's also stored in Secrets Manager as ${SERVICE_NAME}/MCP_AUTH_TOKEN)"
echo "=================================================================="
