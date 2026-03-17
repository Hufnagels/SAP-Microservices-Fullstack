-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: auth_db
-- Generation Time: 2026-03-16 20:35:30.0070
-- -------------------------------------------------------------


DROP TABLE IF EXISTS "public"."auth_users";
-- This script only contains the table creation statements and does not fully represent the table in the database. Do not use it as a backup.

-- Sequence and defined type
CREATE SEQUENCE IF NOT EXISTS auth_users_id_seq;

-- Table Definition
CREATE TABLE "public"."auth_users" (
    "id" int4 NOT NULL DEFAULT nextval('auth_users_id_seq'::regclass),
    "username" varchar(100) NOT NULL,
    "password_hash" varchar(200) NOT NULL,
    "role" varchar(50) NOT NULL DEFAULT 'viewer'::character varying,
    "is_active" bool NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    "name" varchar(200),
    "email" varchar(200),
    "service_roles" jsonb NOT NULL DEFAULT '{}'::jsonb,
    "avatar_mode" varchar(20) DEFAULT 'letter'::character varying,
    "avatar_base64" text,
    PRIMARY KEY ("id")
);

-- Indices
CREATE UNIQUE INDEX auth_users_username_key ON public.auth_users USING btree (username);
