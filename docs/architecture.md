# Enterprise Architecture

## 1. High-level logical architecture

```text
Frontend (Web / Mobile / Admin / BI)
                |
                v
        +------------------+
        | Traefik Gateway  |
        +------------------+
          |      |      |
          |      |      +--------------------------+
          |      |                                 |
          v      v                                 v
   +----------+ +-------------+             +------------------+
   | Auth     | | Orders      |             | Reporting        |
   | Service  | | Service     |             | Service          |
   +----------+ +-------------+             +------------------+
          |             |                              |
          |             +---------+                    |
          |                       |                    |
          v                       v                    v
   +-------------+         +-------------+      +-------------+
   | Postgres    |         | Inventory   |      | ReportingDB |
   | auth_db     |         | Service     |      | / warehouse |
   +-------------+         +-------------+      +-------------+
                                   |
                                   v
                           +------------------+
                           | SAP B1 Adapter   |
                           +------------------+
                                   |
                                   v
                                SAP B1

Sensors / PLC / Devices
        |
        v
+---------------------+
| Sensor Ingest Svc   |
+---------------------+
        |
        v
    RabbitMQ  ---> downstream consumers / reporting / alerts
        |
        v
    events_db
```

## 2. Deployment view

```text
Docker Compose / Kubernetes
├── Gateway
├── App services
├── Messaging
├── Databases
└── Monitoring
```

## 3. Monitoring view

```text
Services --> /metrics --> Prometheus --> Grafana
Services --> logs --------> Promtail --> Loki --> Grafana
```
