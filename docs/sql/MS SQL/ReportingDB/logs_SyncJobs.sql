-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: ReportingDB
-- Generation Time: 2026-03-16 20:31:38.2850
-- -------------------------------------------------------------


DROP TABLE IF EXISTS [dbo].[logs_SyncJobs];
-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: sequences, indices, triggers. Do not use it as a backup.

CREATE TABLE [dbo].[logs_SyncJobs] (
    [job_id] bigint IDENTITY,
    [started_at] datetime2(7),
    [finished_at] datetime2(7),
    [status] nvarchar(20),
    [source_query] nvarchar(100),
    [target_table] nvarchar(100),
    [rows_written] int,
    [error_message] nvarchar(MAX),
    [endpoint] nvarchar(MAX),
    [username] nvarchar(20),
    [sync_type] nvarchar(20) DEFAULT (''),
    PRIMARY KEY ([job_id])
);
