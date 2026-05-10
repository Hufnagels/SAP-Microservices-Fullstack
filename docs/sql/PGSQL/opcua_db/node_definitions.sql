-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: opcua_db
-- Generation Time: 2026-05-09 21:11:07.8140
-- -------------------------------------------------------------


DROP TABLE IF EXISTS "public"."node_definitions";
-- This script only contains the table creation statements and does not fully represent the table in the database. Do not use it as a backup.

-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS node_definitions_id_seq;

-- Table Definition
CREATE TABLE "public"."node_definitions" (
    "id" int4 NOT NULL DEFAULT nextval('node_definitions_id_seq'::regclass),
    "name" varchar(100) NOT NULL,
    "node_id" varchar(300) NOT NULL,
    "type" varchar(20) NOT NULL DEFAULT 'process'::character varying,
    "unit" varchar(30),
    "description" text,
    "is_active" bool NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "sim_behavior" varchar(20) DEFAULT 'sine'::character varying,
    "sim_min" float8 DEFAULT 0,
    "sim_max" float8 DEFAULT 100,
    "sim_period" float8 DEFAULT 30,
    "sim_ramp" numeric,
    "sim_plateau" numeric,
    "sim_off" numeric,
    PRIMARY KEY ("id")
);

INSERT INTO "public"."node_definitions" ("id", "name", "node_id", "type", "unit", "description", "is_active", "created_at", "sim_behavior", "sim_min", "sim_max", "sim_period", "sim_ramp", "sim_plateau", "sim_off") VALUES
(1, 'Temperature', 'ns=2;i=3', 'process', '°C', 'Reactor temperature', 't', '2026-03-20 11:54:19.852477+00', 'random_walk', 18, 32, 60, NULL, NULL, NULL),
(2, 'Pressure', 'ns=2;i=4', 'process', 'bar', 'Line pressure', 't', '2026-03-20 11:54:19.852477+00', 'sine', 0.8, 1.2, 90, NULL, NULL, NULL),
(3, 'Flow Rate', 'ns=2;i=5', 'process', 'm³/h', 'Process flow rate', 't', '2026-03-20 11:54:19.852477+00', 'random_walk', 2, 10, 0, NULL, NULL, NULL),
(4, 'Working speed', 'ns=2;i=6', 'process', 'm/min', 'Actual working speed', 't', '2026-03-20 11:54:19.852477+00', 'trapezoidal', 0, 500, 30, 15, 60, 30),
(5, 'High Temperature', 'ns=2;i=7', 'alarm', NULL, 'High temperature alarm', 't', '2026-03-20 11:54:19.852477+00', 'threshold', 0, 1, 0, NULL, NULL, NULL),
(6, 'Low Pressure', 'ns=2;i=8', 'alarm', NULL, 'Low pressure alarm', 't', '2026-03-20 11:54:19.852477+00', 'threshold', 0, 1, 0, NULL, NULL, NULL),
(7, 'Running', 'ns=2;i=9', 'alarm', NULL, 'Machine running state', 't', '2026-03-20 11:54:19.852477+00', 'constant', 1, 1, 0, NULL, NULL, NULL);
