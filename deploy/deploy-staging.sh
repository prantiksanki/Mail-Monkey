#!/bin/bash
set -euo pipefail

TAG="${1:?usage: deploy-staging.sh <image-tag>}"
REGION=ap-south-1
REPO=522317845919.dkr.ecr.ap-south-1.amazonaws.com/popsuites
DIR=/opt/popsuites/staging

aws ecr get-login-password --region "$REGION" | sudo docker login -u AWS --password-stdin "${REPO%/*}"

sudo docker pull "$REPO:$TAG"
sudo docker tag "$REPO:$TAG" popsuites:staging

cd "$DIR"
sudo docker compose up -d --force-recreate app

for i in $(seq 1 30); do
  if curl -sf -o /dev/null http://127.0.0.1:3001/; then
    echo "Deployed $TAG successfully"
    sudo docker image prune -af --filter "until=72h" > /dev/null || true
    exit 0
  fi
  sleep 2
done

echo "New version failed health check, showing logs:"
sudo docker compose logs --tail=80 app
exit 1
