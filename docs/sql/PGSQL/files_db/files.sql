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

INSERT INTO "public"."files" ("id", "name", "mime_type", "size", "description", "tags", "uploaded", "project", "folder", "file_path", "uploaded_by") VALUES
(1, '120Autocut.jpg', 'image/jpeg', 180075, '', '{}', '2026-03-13', '', 'labels', 'labels/1c911e0c-0d34-493e-9c3b-cdc236b6d7e4.jpg', 'admin'),
(2, '20240823_megrendeles_gyartasiutasitasok 2.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 15157, '', '{order,production}', '2026-03-13', '', 'riport', 'riport/68f6316c-b477-4858-934a-928e8f209ca5.xlsx', 'admin'),
(3, 'auth-ui-demo.mp4', 'video/mp4', 19333862, '', '{video,signin}', '2026-03-13', '', 'videos', 'videos/9772dcd2-1942-416a-834c-0be349b03039.mp4', 'admin'),
(4, 'sap-sync-ui-demo.mp4', 'video/mp4', 7908427, '', '{video,signin}', '2026-03-13', '', 'videos', 'videos/932a7101-a632-4422-8729-b38216eecedf.mp4', 'admin'),
(5, '7692924-hd_1920_1080_25fps.mp4', 'video/mp4', 7999528, '', '{video,sales}', '2026-03-13', '', 'videos', 'videos/14d4cc3f-8d1c-45b9-a82f-f390b1af9dcb.mp4', 'admin');
