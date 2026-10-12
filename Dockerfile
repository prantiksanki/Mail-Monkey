# syntax=docker/dockerfile:1
# cache-bust: 2026-10-02b — force a clean rebuild after NEXT_PUBLIC_SITE_URL secret fix
FROM node:22-slim AS base
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app

# Isolate just the "web" app and its workspace deps so the install layer
# only invalidates when something it actually depends on changes.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.4 prune web --docker

FROM base AS installer
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .

ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_DOCS_URL
ENV NEXT_PUBLIC_DOCS_URL=$NEXT_PUBLIC_DOCS_URL
ARG NEXT_PUBLIC_AVATARS_BUCKET_NAME
ENV NEXT_PUBLIC_AVATARS_BUCKET_NAME=$NEXT_PUBLIC_AVATARS_BUCKET_NAME
ARG NEXT_PUBLIC_APP_ENV
ENV NEXT_PUBLIC_APP_ENV=$NEXT_PUBLIC_APP_ENV
ARG NEXT_PUBLIC_ENZUZO_COOKIEBAR_ID
ENV NEXT_PUBLIC_ENZUZO_COOKIEBAR_ID=$NEXT_PUBLIC_ENZUZO_COOKIEBAR_ID
ARG NEXT_PUBLIC_GOOGLE_ADS_ID
ENV NEXT_PUBLIC_GOOGLE_ADS_ID=$NEXT_PUBLIC_GOOGLE_ADS_ID
ARG NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
ENV NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=$NEXT_PUBLIC_GOOGLE_ANALYTICS_ID
ARG NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID
ENV NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID=$NEXT_PUBLIC_GOOGLE_TAG_MANAGER_ID
ARG NEXT_PUBLIC_MIXPANEL_TOKEN
ENV NEXT_PUBLIC_MIXPANEL_TOKEN=$NEXT_PUBLIC_MIXPANEL_TOKEN
ARG NEXT_PUBLIC_PIRSCH_CODE
ENV NEXT_PUBLIC_PIRSCH_CODE=$NEXT_PUBLIC_PIRSCH_CODE
ARG NEXT_PUBLIC_PLAUSIBLE_URL
ENV NEXT_PUBLIC_PLAUSIBLE_URL=$NEXT_PUBLIC_PLAUSIBLE_URL
ARG NEXT_PUBLIC_POSTHOG_KEY
ENV NEXT_PUBLIC_POSTHOG_KEY=$NEXT_PUBLIC_POSTHOG_KEY
ARG NEXT_PUBLIC_PRICE_ID_PAID_BOOKING
ENV NEXT_PUBLIC_PRICE_ID_PAID_BOOKING=$NEXT_PUBLIC_PRICE_ID_PAID_BOOKING
ARG NEXT_PUBLIC_PRICE_ID_PREMIUM_MONTHLY
ENV NEXT_PUBLIC_PRICE_ID_PREMIUM_MONTHLY=$NEXT_PUBLIC_PRICE_ID_PREMIUM_MONTHLY
ARG NEXT_PUBLIC_PRICE_ID_PREMIUM_YEARLY
ENV NEXT_PUBLIC_PRICE_ID_PREMIUM_YEARLY=$NEXT_PUBLIC_PRICE_ID_PREMIUM_YEARLY
ARG NEXT_PUBLIC_PRICE_ID_PRO_MONTHLY
ENV NEXT_PUBLIC_PRICE_ID_PRO_MONTHLY=$NEXT_PUBLIC_PRICE_ID_PRO_MONTHLY
ARG NEXT_PUBLIC_PRICE_ID_PRO_YEARLY
ENV NEXT_PUBLIC_PRICE_ID_PRO_YEARLY=$NEXT_PUBLIC_PRICE_ID_PRO_YEARLY
ARG NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY
ENV NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY=$NEXT_PUBLIC_PRICE_ID_STARTER_MONTHLY
ARG NEXT_PUBLIC_PRICE_ID_STARTER_YEARLY
ENV NEXT_PUBLIC_PRICE_ID_STARTER_YEARLY=$NEXT_PUBLIC_PRICE_ID_STARTER_YEARLY
ARG NEXT_PUBLIC_PRICE_ID_VOICE_ADDON
ENV NEXT_PUBLIC_PRICE_ID_VOICE_ADDON=$NEXT_PUBLIC_PRICE_ID_VOICE_ADDON
ARG NEXT_PUBLIC_UMAMI_TRACKING_ID
ENV NEXT_PUBLIC_UMAMI_TRACKING_ID=$NEXT_PUBLIC_UMAMI_TRACKING_ID
ARG NEXT_PUBLIC_VERCEL_URL
ENV NEXT_PUBLIC_VERCEL_URL=$NEXT_PUBLIC_VERCEL_URL

# DATABASE_URL/DIRECT_URL/BETTER_AUTH_SECRET are needed at build time too:
# prisma.config.ts reads them for `prisma generate`, and Better Auth
# initializes during Next's page-data collection (see deploy-prod.yml).
# Mounted as BuildKit secrets, not ARG/ENV, so they never land in an image
# layer or `docker history`. Pass with:
#   docker build --secret id=database_url,env=DATABASE_URL \
#                --secret id=direct_url,env=DIRECT_URL \
#                --secret id=better_auth_secret,env=BETTER_AUTH_SECRET .
# Default Node heap is too small for this monorepo's post-compile type
# check; CI needed 4GB (see deploy-prod.yml's "Build web app" step).
RUN --mount=type=secret,id=database_url,env=DATABASE_URL \
    --mount=type=secret,id=direct_url,env=DIRECT_URL \
    --mount=type=secret,id=better_auth_secret,env=BETTER_AUTH_SECRET \
    NODE_OPTIONS="--max-old-space-size=4096" \
    pnpm dlx turbo@2.11.4 run build --filter=web

FROM base AS runner
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
# Server-side code (Better Auth's trustedOrigins/baseURL, mail templates)
# reads NEXT_PUBLIC_SITE_URL via process.env at runtime, not just from the
# client bundle it's inlined into at build time. Without this the runner
# stage never had it set, so getBaseUrl() silently fell back to
# http://localhost:3000 in production — breaking OAuth login's trusted
# origin check. Deploys should still also set it in the server's .env as
# the authoritative runtime value; this is a safety net, not a replacement.
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL
# output: "standalone" + outputFileTracingRoot (apps/web/next.config.ts) keeps
# paths relative to the monorepo root, so the entrypoint lands at apps/web/.
COPY --from=installer /app/apps/web/.next/standalone ./
COPY --from=installer /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=installer /app/apps/web/public ./apps/web/public
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
