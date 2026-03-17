-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: files_db
-- Generation Time: 2026-03-16 20:36:36.6030
-- -------------------------------------------------------------


DROP TABLE IF EXISTS "public"."files";
-- This script only contains the table creation statements and does not fully represent the table in the database. Do not use it as a backup.

-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS files_id_seq;

-- Table Definition
CREATE TABLE "public"."files" (
    "id" int4 NOT NULL DEFAULT nextval('files_id_seq'::regclass),
    "name" text NOT NULL,
    "mime_type" text NOT NULL,
    "size" int4 NOT NULL,
    "description" text NOT NULL DEFAULT ''::text,
    "tags" _text NOT NULL DEFAULT '{}'::text[],
    "uploaded" text NOT NULL DEFAULT ''::text,
    "project" text NOT NULL DEFAULT ''::text,
    "folder" text NOT NULL DEFAULT ''::text,
    "file_path" text NOT NULL,
    "uploaded_by" text NOT NULL DEFAULT ''::text,
    PRIMARY KEY ("id")
);

