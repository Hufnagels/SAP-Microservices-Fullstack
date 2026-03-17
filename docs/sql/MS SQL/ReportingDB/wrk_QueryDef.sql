-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: ReportingDB
-- Generation Time: 2026-03-16 20:32:05.8550
-- -------------------------------------------------------------


DROP TABLE IF EXISTS [dbo].[wrk_QueryDef];
-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: sequences, indices, triggers. Do not use it as a backup.

CREATE TABLE [dbo].[wrk_QueryDef] (
    [query_id] int IDENTITY,
    [query_name] nvarchar(100),
    [base_table] nvarchar(255),
    [sql_original] nvarchar(MAX),
    [force_lables] nvarchar(MAX),
    [is_active] bit DEFAULT ((1)),
    [created_at] datetime2(7) DEFAULT (sysdatetime()),
    [username] nvarchar(20) DEFAULT (''),
    [description] nvarchar(MAX),
    [sql_b1_comp_base_query] nvarchar(MAX),
    [sql_b1_comp_extra_options] nvarchar(MAX),
    [service_name] nvarchar(100) DEFAULT (''),
    PRIMARY KEY ([query_id])
);
