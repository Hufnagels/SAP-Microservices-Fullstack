# Microservices Enterprise Starter

Enterprise-grade starter architecture for:

- FastAPI microservices
- Traefik API Gateway
- RabbitMQ event bus
- SAP B1 adapter (Service Layer stub + SQL example)
- Sensor ingest pipeline
- PostgreSQL operational databases
- Monitoring stack: Prometheus + Grafana + Loki + Promtail
- Docker Compose local environment
- Kubernetes manifests starter
- Helm chart starter
- OpenTelemetry-ready app settings

## Services

- gateway (Traefik)
- auth-service
- orders-service
- inventory-service
- reporting-service
- sensor-ingest-service
- sap-b1-adapter-service
- rabbitmq
- postgres-auth
- postgres-orders
- postgres-inventory
- postgres-reporting
- postgres-events
- prometheus
- grafana
- loki
- promtail

## Run locally

```bash
cp .env.example .env
docker compose up --build
```

## Main URLs

- Gateway: http://localhost
- Traefik dashboard: http://localhost:8080
- RabbitMQ management: http://localhost:15672
- Grafana: http://localhost:3000
- Prometheus: http://localhost:9090

## Notes

This is a starter, not a production-hardened release. Before real deployment, add:
- secret management
- TLS certificates
- backup policy
- network policies
- identity provider integration
- vulnerability scanning
- CI/CD promotion gates
