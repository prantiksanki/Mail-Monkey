# Only the secret "container" (name, description, tags) is managed here.
# Deliberately NOT declaring aws_secretsmanager_secret_version - the real
# credential values already exist and were set manually. Terraform must
# never overwrite or rotate them as a side effect of an unrelated apply.

resource "aws_secretsmanager_secret" "grafana_cloud" {
  name        = "popsuites/grafana-cloud-credentials"
  description = "Grafana Cloud Prometheus remote_write credentials for Alloy"
}

resource "aws_secretsmanager_secret" "metrics_scrape_token" {
  name        = "popsuites/metrics-scrape-token"
  description = "Shared secret Alloy sends when scraping the app's /metrics endpoint"
}
