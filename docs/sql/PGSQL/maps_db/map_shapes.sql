-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: maps_db
-- Generation Time: 2026-05-10 09:13:57.5760
-- -------------------------------------------------------------


DROP TABLE IF EXISTS "public"."map_shapes";
-- This script only contains the table creation statements and does not fully represent the table in the database. Do not use it as a backup.

-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS map_shapes_id_seq;

-- Table Definition
CREATE TABLE "public"."map_shapes" (
    "id" int4 NOT NULL DEFAULT nextval('map_shapes_id_seq'::regclass),
    "name" varchar(255) NOT NULL DEFAULT ''::character varying,
    "type" varchar(50) NOT NULL,
    "description" text,
    "lat" float8,
    "lng" float8,
    "radius" float8,
    "bounds_ne" jsonb,
    "bounds_sw" jsonb,
    "latlngs" jsonb,
    "created_at" timestamptz DEFAULT now(),
    PRIMARY KEY ("id")
);

INSERT INTO "public"."map_shapes" ("id", "name", "type", "description", "lat", "lng", "radius", "bounds_ne", "bounds_sw", "latlngs", "created_at") VALUES
(1, 'Marker #1', 'Marker', NULL, 49.031565622700356, 5.976562500000001, NULL, NULL, NULL, NULL, '2026-03-13 10:38:33.376402+00'),
(2, 'Rectangle #2', 'Rectangle', NULL, NULL, NULL, NULL, '[50.73037076236953, 14.677734375000002]', '[47.153303174225975, 8.964843750000002]', NULL, '2026-03-13 10:38:33.376402+00'),
(3, 'Polygon #3', 'Polygon', NULL, NULL, NULL, NULL, NULL, NULL, '[[47.865695264743216, 4.746093750000001], [49.490430536762666, 4.218750000000001], [51.5027589576403, 5.273437500000001], [51.82983706423939, 7.910156250000001], [50.73037076236953, 8.964843750000002]]', '2026-03-13 10:38:33.376402+00'),
(4, 'Polygon #1', 'Polygon', NULL, NULL, NULL, NULL, NULL, NULL, '[[47.381846628350104, 5.141601562500001], [48.68937392596874, 7.404785156250001], [46.9486216729956, 7.800292968750001], [46.54209661464723, 5.77880859375]]', '2026-03-13 11:17:03.80729+00'),
(5, 'Rectangle #2', 'Rectangle', NULL, NULL, NULL, NULL, '[50.04225803647891, 7.141113281250001]', '[49.11624254855665, 5.438232421875]', NULL, '2026-03-13 11:17:28.709003+00'),
(6, 'Marker #3', 'Marker', NULL, 48.43569272871213, 4.987792968750001, NULL, NULL, NULL, NULL, '2026-03-13 11:17:28.709003+00'),
(7, 'Marker #4', 'Marker', 'cccc', 45.944465613675035, 21.621093750000004, NULL, NULL, NULL, NULL, '2026-03-13 11:18:48.716283+00');
