# Grafana Alloy collector for Popsuites — see infra/alloy/README.md.
# Runs as its own small container, separate from the App Service (which
# can't host a sidecar), per Option A of the observability plan.

FROM grafana/alloy:latest

COPY config.alloy /etc/alloy/config.alloy

EXPOSE 12345
