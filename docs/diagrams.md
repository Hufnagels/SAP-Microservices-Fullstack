# Architecture Diagrams

## Context diagram

```text
[Users]
  |
  v
[Frontend Apps]
  |
  v
[Gateway]
  |
  +--> [Auth Service]
  +--> [Orders Service]
  +--> [Inventory Service]
  +--> [Reporting Service]
  +--> [Sensor Ingest]
  +--> [SAP B1 Adapter]
```

## Event flow diagram

```text
Sensor Device
   |
   v
Sensor Ingest API
   |
   v
RabbitMQ exchange: sensor.events
   |
   +--> Reporting consumer
   +--> Alerting consumer
   +--> Traceability consumer
```

## SAP integration diagram

```text
Orders Service / Inventory Service
                |
                v
        SAP B1 Adapter Service
           |            |
           |            +--> SQL Read Example
           |
           +--> Service Layer API
```

## Monitoring diagram

```text
FastAPI services --> Prometheus scrape
FastAPI services --> Promtail log shipping --> Loki
Grafana --> Prometheus + Loki dashboards
```
