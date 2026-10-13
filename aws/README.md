# Hosting Mail Monkey on AWS

Every push to `main` runs `.github/workflows/deploy-aws.yml`:

1. gitleaks scans the repo for leaked secrets.
2. GitHub Actions builds the Docker image (`Dockerfile`) and pushes it to ECR.
3. It sends `aws/server-deploy.sh` to the EC2 server through SSM, which pulls
   the image, loads the app's settings from Parameter Store and restarts the
   app behind Caddy (automatic HTTPS).

The site is served at `https://<elastic-ip>.sslip.io`, a free hostname that
always resolves to the server's IP.

## One-time setup

Region used throughout: **Asia Pacific (Mumbai) `ap-south-1`**. Switch to it in
the top-right of the AWS Console first.

### 1. Store the app settings in Parameter Store

1. Open **Systems Manager → Parameter Store → Create parameter**.
2. Name: `/mailmonkey/prod/env`, Tier: **Standard**, Type: **SecureString**.
3. Value: the contents of your local `.env` **without comment lines**
   (Standard tier allows 4 KB). `NEXT_PUBLIC_SITE_URL` is overwritten on the
   server with the HTTPS URL, so its value here doesn't matter.

### 2. Create the AWS resources

1. Open **CloudFormation → Create stack → With new resources**.
2. Upload `aws/mailmonkey-stack.yml`. Stack name: `mailmonkey`.
3. Keep the defaults. If your account already has a GitHub identity provider
   (IAM → Identity providers → `token.actions.githubusercontent.com`), set
   `CreateGitHubOidcProvider` to `false`.
4. Tick "I acknowledge that AWS CloudFormation might create IAM resources with
   custom names" and create the stack (about 5 minutes).
5. Open the stack's **Outputs** tab; you need its values next.

### 3. Configure GitHub

Repository → **Settings → Secrets and variables → Actions**.

**Variables** tab:

| Name | Value |
| --- | --- |
| `AWS_DEPLOY_ROLE_ARN` | stack output `DeployRoleArn` |
| `ECR_REPOSITORY_URI` | stack output `EcrRepositoryUri` |
| `EC2_INSTANCE_ID` | stack output `InstanceId` |
| `APP_URL` | stack output `AppUrl` |
| `AWS_REGION` | `ap-south-1` |

Optionally also add the `NEXT_PUBLIC_*` values from your `.env`
(`NEXT_PUBLIC_AVATARS_BUCKET_NAME`, the `NEXT_PUBLIC_PRICE_ID_*` ones, …);
they're baked into the browser bundle at build time.

**Secrets** tab (needed while building): `DATABASE_URL`, `DIRECT_URL`,
`BETTER_AUTH_SECRET`, with the same values as in `.env`.

### 4. Allow the new URL in Google sign-in

Google Cloud Console → **APIs & Services → Credentials →** your OAuth client:

- Authorized JavaScript origins: the `AppUrl` value
- Authorized redirect URIs: `<AppUrl>/api/auth/callback/google`

### 5. Deploy

Push to `main`, or run **Actions → Deploy to AWS → Run workflow**. The first
build takes about 10–15 minutes; later ones are faster thanks to the build
cache. Open `AppUrl` when the run is green.

## Day to day

- **Change a setting:** edit `/mailmonkey/prod/env` in Parameter Store, then
  re-run the workflow (Actions → Deploy to AWS → Run workflow).
- **Logs:** EC2 → the `mailmonkey-prod` instance → **Connect → Session
  Manager**, then `cd /opt/mailmonkey && sudo docker compose logs -f app`.
- **Cost:** a t3.small with a 30 GB disk is roughly $17–20/month in Mumbai.
  To stop paying, delete the `mailmonkey` CloudFormation stack (it removes the
  server, IP, roles and image repository; delete the ECR images first if the
  stack deletion complains).
