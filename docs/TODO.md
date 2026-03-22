# TODO — Deferred Decisions

Items that need a decision before implementation. Each entry has context so the choice can be made without re-investigating.

---

## Infrastructure

### RabbitMQ — keep or remove?

**Current state:** Running in `docker-compose.yml`, wastes resources, caused a startup permission error (fixed by switching to named volume).

**Actual usage:**
- `sensor-ingest-service` — one `publish_json(...)` call, but the service itself is a stub (not built)
- `orders-service`, `reporting-service`, `inventory-service` — `amqp` in `requirements.txt`, zero usage in code
- All other services — not referenced at all

**Options:**
- **Remove now** — clean up `docker-compose.yml`, `startup.sh`, `shutdown.sh`. Re-add when stub services are built and actually need async messaging.
- **Keep** — if inter-service messaging is coming soon (e.g. sensor events → reporting pipeline).

**Decision needed:** Will the stub services (sensor-ingest, orders, inventory, reporting) be built out and need async messaging in the near future?

---

### Loki + Promtail — keep or remove?

**Current state:** Both running. Promtail scrapes all Docker container stdout → pushes to Loki. No Grafana datasource or dashboard is configured for it. Nobody reads the logs.

**Actual usage:** Zero — logs are collected but never queried.

**Prometheus is used** (scrapes `/metrics` from all services, Grafana displays it). Loki is separate — it handles *log lines*, not metrics.

**Options:**
- **Remove** — saves RAM, simpler stack. `docker logs` / `make logs` still works for local dev.
- **Wire it up** — add Loki datasource in Grafana + a logs dashboard. Gives centralized log search across all containers in Grafana. Useful in production.
- **Keep but ignore** — low cost, can wire up later without data loss.

**Decision needed:** Do we want centralized log search in Grafana (production ops use case), or is `make logs` / per-container `docker logs` sufficient?

---
