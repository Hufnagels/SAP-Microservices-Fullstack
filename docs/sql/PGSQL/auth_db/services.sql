-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: auth_db
-- Generation Time: 2026-05-09 21:04:21.1190
-- -------------------------------------------------------------


DROP TABLE IF EXISTS "public"."services";
-- This script only contains the table creation statements and does not fully represent the table in the database. Do not use it as a backup.

-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS services_id_seq;

-- Table Definition
CREATE TABLE "public"."services" (
    "id" int4 NOT NULL DEFAULT nextval('services_id_seq'::regclass),
    "name" varchar(100) NOT NULL,
    "pascal_name" varchar(100),
    "description" text,
    "service_url" varchar(300),
    "port" int4,
    "make_command" varchar(200),
    "api_endpoint" varchar(200),
    "is_active" bool NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("id")
);

-- Indices
CREATE UNIQUE INDEX services_name_key ON public.services USING btree (name);

INSERT INTO "public"."services" ("id", "name", "pascal_name", "description", "service_url", "port", "make_command", "api_endpoint", "is_active", "created_at") VALUES
(1, 'auth-service', 'AuthService', 'JWT authentication, user management, role permissions', 'http://auth-service:8000', 8000, 'make dev-auth', '/auth', 't', '2026-03-14 18:13:20.758088+00'),
(2, 'sap-b1-adapter-service', 'SapB1AdapterService', 'SAP B1 Service Layer adapter — sync queries to MSSQL', 'http://sap-b1-adapter-service:8000', 8000, 'make up-sap', '/sap', 't', '2026-03-14 18:13:20.758088+00'),
(3, 'file-service', 'FileService', 'File upload/download with PostgreSQL metadata store', 'http://file-service:8000', 8000, 'make up', '/files', 't', '2026-03-14 18:13:20.758088+00'),
(4, 'binpack-service', 'BinpackService', '3D bin packing optimisation service', 'http://binpack-service:8000', 8000, 'make up-binpack', '/binpack', 't', '2026-03-14 18:13:20.758088+00'),
(5, 'labeling-service', 'LabelingService', 'Live labeling and label printing service', 'http://labeling-service:8000', 8000, 'make up-labeling', '/labeling', 't', '2026-03-14 18:13:20.758088+00'),
(6, 'orders-service', 'OrdersService', 'Order management service (stub)', 'http://orders-service:8000', 8000, 'make up', '/orders', 't', '2026-03-14 18:13:20.758088+00'),
(7, 'inventory-service', 'InventoryService', 'Inventory management service (stub)', 'http://inventory-service:8000', 8000, 'make up', '/inventory', 't', '2026-03-14 18:13:20.758088+00'),
(8, 'reporting-service', 'ReportingService', 'Reporting and analytics service (stub)', 'http://reporting-service:8000', 8000, 'make up', '/reporting', 't', '2026-03-14 18:13:20.758088+00'),
(9, 'sensor-ingest-service', 'SensorIngestService', 'Sensor data ingest and event pipeline (stub)', 'http://sensor-ingest-service:8000', 8000, 'make up', '/sensor', 't', '2026-03-14 18:13:20.758088+00'),
(10, 'maps-service', 'MapsService', 'Geospatial / Leaflet map data service (stub)', 'http://maps-service:8000', 8000, 'make up', '/maps', 't', '2026-03-14 18:13:20.758088+00'),
(11, 'opcua-service', 'OpcuaService', 'Siemens S7-1500 OPC-UA polling, InfluxDB timeseries persistence', 'http://opcua-service:8000', 8000, 'make up-opcua', '/opcua', 't', '2026-03-20 09:56:02.372075+00');
