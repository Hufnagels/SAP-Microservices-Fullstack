-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: auth_db
-- Generation Time: 2026-03-16 20:35:43.0740
-- -------------------------------------------------------------


DROP TABLE IF EXISTS "public"."role_permissions";
-- This script only contains the table creation statements and does not fully represent the table in the database. Do not use it as a backup.

-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS role_permissions_id_seq;

-- Table Definition
CREATE TABLE "public"."role_permissions" (
    "id" int4 NOT NULL DEFAULT nextval('role_permissions_id_seq'::regclass),
    "permissions" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "role_name" varchar(100) NOT NULL,
    PRIMARY KEY ("id")
);

-- Indices
CREATE UNIQUE INDEX role_permissions_role_name_key ON public.role_permissions USING btree (role_name);

INSERT INTO "public"."role_permissions" ("id", "permissions", "role_name") VALUES
(2, '{"auth-service": ["create", "read", "update", "delete"], "file-service": ["create", "read", "update"], "maps-service": ["create", "read", "update"], "orders-service": ["create", "read", "update"], "binpack-service": ["read", "update", "create"], "labeling-service": ["create", "read", "update"], "inventory-service": ["create", "read", "update"], "reporting-service": ["create", "read", "update"], "sensor-ingest-service": ["read", "create", "update"], "sap-b1-adapter-service": ["create", "read", "update"]}', 'admin'),
(3, '{"auth-service": [], "file-service": ["read"], "maps-service": ["read"], "orders-service": ["read"], "binpack-service": ["read"], "labeling-service": ["read"], "inventory-service": ["read"], "reporting-service": ["read"], "sensor-ingest-service": ["read"], "sap-b1-adapter-service": ["read"]}', 'viewer'),
(4, '{"auth-service": [], "file-service": ["create", "read", "update"], "maps-service": ["read", "create", "update"], "orders-service": [], "binpack-service": ["read", "create", "update"], "labeling-service": ["create", "read", "update"], "inventory-service": ["create", "update", "read"], "reporting-service": ["read", "create", "update"], "sensor-ingest-service": ["create", "read", "update"], "sap-b1-adapter-service": ["read", "update"]}', 'operator'),
(5, '{"auth-service": ["create", "read", "update", "delete"], "file-service": ["create", "read", "update", "delete"], "maps-service": ["create", "read", "update", "delete"], "orders-service": ["create", "read", "update", "delete"], "binpack-service": ["create", "read", "update", "delete"], "labeling-service": ["create", "read", "update", "delete"], "inventory-service": ["create", "read", "update", "delete"], "reporting-service": ["create", "read", "update", "delete"], "sensor-ingest-service": ["create", "read", "update", "delete"], "sap-b1-adapter-service": ["create", "read", "update", "delete"]}', 'superadmin'),
(6, '{"auth-service": [], "file-service": ["read", "update"], "maps-service": ["read", "update"], "orders-service": ["read", "update"], "binpack-service": ["read", "update"], "labeling-service": ["create", "read", "update"], "inventory-service": ["read", "update"], "reporting-service": ["read", "update"], "sensor-ingest-service": ["create", "read", "update"], "sap-b1-adapter-service": ["update"]}', 'worker');
