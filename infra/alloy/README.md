# Alloy collector (Popsuites observability)

Runs [Grafana Alloy](https://grafana.com/docs/alloy/latest/) as its own
container to scrape `GET /api/metrics` from the app and forward it to
Grafana Cloud's hosted Prometheus. This is separate infrastructure from the
App Service — App Service can't run a sidecar, so Alloy runs on its own
Azure Container Instance instead. See `/popsuites-observability-plan.html`
(Option A) for the full rationale.

Scope of this pass: **metrics only**. Log shipping (Loki) is a later phase.

## Env vars this container needs

The scrape target (prod's hostname, `https`, path `/api/metrics`) and the
`remote_write` URL are hardcoded in `config.alloy` — this container is
currently wired to prod only. Credentials are still env vars, set as secure
env vars on the Container Instance itself, never committed:

| Var | Where it comes from | Notes |
|---|---|---|
| `METRICS_SCRAPE_TOKEN` | Must match the app's `METRICS_SCRAPE_TOKEN` (set on the prod App Service itself) | Same value on both sides — this is what `apps/web/app/api/metrics/route.ts` checks |
| `GRAFANA_CLOUD_USERNAME` | Grafana Cloud → Connections → Hosted Prometheus metrics → Via Grafana Alloy | Numeric Prometheus username/instance ID |
| `GRAFANA_CLOUD_PASSWORD` | Same Grafana Cloud screen — "Create a new token", scope `set:alloy-data-write` | Shown once at creation — copy it immediately |

To point this at staging instead, edit the `__address__` (and `environment`
label) in `config.alloy` directly, or reintroduce `env("APP_METRICS_HOST")` /
`env("APP_ENV")` if you need to run one image against both environments.

**Before deploying:** set `METRICS_SCRAPE_TOKEN` on the App Service (both
staging and prod) to a freshly generated random value — it isn't set today,
so `/api/metrics` is currently open. Use the same value here.

## Build & push the image

Pick whichever registry you already use for other containers, or create an
Azure Container Registry (ACR) if you don't have one yet:

```bash
az acr create --resource-group <RESOURCE_GROUP> --name <ACR_NAME> --sku Basic
az acr login --name <ACR_NAME>

docker build -t <ACR_NAME>.azurecr.io/popsuites-alloy:latest infra/alloy
docker push <ACR_NAME>.azurecr.io/popsuites-alloy:latest
```

## Deploy as an Azure Container Instance

Runs in the same resource group as the App Service so it can reach it over
the network. Fill in the placeholders — nothing here should contain a real
secret; pass those via `--secure-environment-variables` at run time, not by
editing this file.

```bash
az container create \
  --resource-group <RESOURCE_GROUP> \
  --name popsuites-alloy \
  --image <ACR_NAME>.azurecr.io/popsuites-alloy:latest \
  --registry-login-server <ACR_NAME>.azurecr.io \
  --registry-username <ACR_USERNAME> \
  --registry-password <ACR_PASSWORD> \
  --cpu 0.5 --memory 0.5 \
  --restart-policy Always \
  --secure-environment-variables \
    METRICS_SCRAPE_TOKEN=<METRICS_SCRAPE_TOKEN> \
    GRAFANA_CLOUD_USERNAME=<GRAFANA_CLOUD_USERNAME> \
    GRAFANA_CLOUD_PASSWORD=<GRAFANA_CLOUD_PASSWORD>
```

`config.alloy` currently targets prod only — see the note above if you also
want staging observed.

## Verify it's working

In Grafana Cloud → Explore → Prometheus, run:

```
up{job="popsuites"}
```

`1` means Alloy is scraping successfully. Then confirm the app-specific
metrics are arriving, e.g.:

```
popsuites_rule_execution_total
```

If `up` is `0` or missing: check the Container Instance logs
(`az container logs --resource-group <RESOURCE_GROUP> --name popsuites-alloy`)
— the two most common causes are `METRICS_SCRAPE_TOKEN` mismatch (401 from
the app) or the wrong `APP_METRICS_HOST`.
