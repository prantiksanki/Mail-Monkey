#!/bin/bash
# Runs ON the EC2 server (sent by .github/workflows/deploy-aws.yml via SSM).
# Pulls the new image, refreshes the app's .env from Parameter Store, and
# restarts the app behind Caddy, which serves HTTPS on <public-ip>.sslip.io.
set -euo pipefail

IMAGE="${1:?usage: server-deploy.sh <image-uri:tag> <region> [env-parameter-name]}"
REGION="${2:?usage: server-deploy.sh <image-uri:tag> <region> [env-parameter-name]}"
ENV_PARAM="${3:-/mailmonkey/prod/env}"
DIR=/opt/mailmonkey

mkdir -p "$DIR"
cd "$DIR"

# Public (Elastic) IP from instance metadata (IMDSv2) -> stable hostname.
TOKEN=$(curl -sf -X PUT http://169.254.169.254/latest/api/token \
	-H "X-aws-ec2-metadata-token-ttl-seconds: 300")
PUBLIC_IP=$(curl -sf -H "X-aws-ec2-metadata-token: $TOKEN" \
	http://169.254.169.254/latest/meta-data/public-ipv4)
HOST="${PUBLIC_IP}.sslip.io"
SITE_URL="https://${HOST}"

# App settings: the .env stored in Parameter Store, with the site URL forced
# to this server's public address.
umask 077
aws ssm get-parameter --region "$REGION" --name "$ENV_PARAM" --with-decryption \
	--query Parameter.Value --output text |
	grep -v '^NEXT_PUBLIC_SITE_URL=' >.env.new
echo "NEXT_PUBLIC_SITE_URL=${SITE_URL}" >>.env.new
mv .env.new .env

cat >Caddyfile <<EOF
${HOST} {
	encode zstd gzip
	reverse_proxy app:3000
}
EOF

cat >docker-compose.yml <<EOF
services:
  app:
    image: ${IMAGE}
    env_file: .env
    restart: unless-stopped
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - caddy_data:/data
      - caddy_config:/config
    depends_on:
      - app
volumes:
  caddy_data:
  caddy_config:
EOF

aws ecr get-login-password --region "$REGION" |
	docker login --username AWS --password-stdin "${IMAGE%%/*}"
docker pull "$IMAGE"
docker compose up -d --remove-orphans

echo "Waiting for the app to answer..."
for _ in $(seq 1 60); do
	if docker compose exec -T app node -e \
		"fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.status<500?0:1)).catch(()=>process.exit(1))"; then
		echo "Deployed ${IMAGE} at ${SITE_URL}"
		docker image prune -af --filter "until=72h" >/dev/null || true
		exit 0
	fi
	sleep 3
done

echo "New version failed its health check; recent logs:"
docker compose logs --tail=80 app
exit 1
