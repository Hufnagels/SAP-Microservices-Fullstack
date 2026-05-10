-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: maps_db
-- Generation Time: 2026-05-10 09:13:29.4580
-- -------------------------------------------------------------


DROP TABLE IF EXISTS "public"."map_custom";
-- This script only contains the table creation statements and does not fully represent the table in the database. Do not use it as a backup.

-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS map_custom_id_seq;

-- Table Definition
CREATE TABLE "public"."map_custom" (
    "id" int4 NOT NULL DEFAULT nextval('map_custom_id_seq'::regclass),
    "name" varchar(255) NOT NULL,
    "lat" float8 NOT NULL,
    "lng" float8 NOT NULL,
    "type" varchar(50) NOT NULL DEFAULT 'marker'::character varying,
    "description" text NOT NULL DEFAULT ''::text,
    "bounds_ne" jsonb,
    "bounds_sw" jsonb,
    "created_at" timestamptz DEFAULT now(),
    PRIMARY KEY ("id")
);

