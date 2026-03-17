-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: ReportingDB
-- Generation Time: 2026-03-16 20:32:18.4230
-- -------------------------------------------------------------


DROP TABLE IF EXISTS [dbo].[wrk_TableDesc];
-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: sequences, indices, triggers. Do not use it as a backup.

CREATE TABLE [dbo].[wrk_TableDesc] (
    [table_id] int IDENTITY,
    [table_name] nvarchar(255),
    [owner] nvarchar(50),
    [description] nvarchar(200),
    [is_active] bit DEFAULT ((1)),
    [created_at] datetime2(7) DEFAULT (sysdatetime()),
    PRIMARY KEY ([table_id])
);

