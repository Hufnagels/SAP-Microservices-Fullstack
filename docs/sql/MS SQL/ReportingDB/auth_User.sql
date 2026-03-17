-- -------------------------------------------------------------
-- TablePlus 6.0.0(550)
--
-- https://tableplus.com/
--
-- Database: ReportingDB
-- Generation Time: 2026-03-16 20:31:22.2930
-- -------------------------------------------------------------


DROP TABLE IF EXISTS [dbo].[auth_User];
-- This script only contains the table creation statements and does not fully represent the table in the database. It's still missing: sequences, indices, triggers. Do not use it as a backup.

CREATE TABLE [dbo].[auth_User] (
    [UserId] int IDENTITY,
    [Username] nvarchar(100),
    [PasswordHash] nvarchar(255),
    [Role] nvarchar(50),
    [IsActive] bit DEFAULT ((1)),
    [CreatedAt] datetime2(7) DEFAULT (sysdatetime()),
    PRIMARY KEY ([UserId])
);

