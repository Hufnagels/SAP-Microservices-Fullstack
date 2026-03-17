USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'pisti')
BEGIN
    CREATE LOGIN [pisti]
        WITH PASSWORD = 'Mancika1972',
        CHECK_POLICY = ON,
        CHECK_EXPIRATION = ON;
END
GO

IF DB_ID(N'ReportingDB') IS NULL
    CREATE DATABASE [ReportingDB];
GO

USE [ReportingDB];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'pisti')
BEGIN
    CREATE USER [pisti] FOR LOGIN [pisti];
    ALTER ROLE db_owner ADD MEMBER [pisti];
END
GO

-- AUTH
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'auth_User')
BEGIN
    CREATE TABLE dbo.auth_User (
        UserId        INT IDENTITY PRIMARY KEY,
        Username      NVARCHAR(100) UNIQUE NOT NULL,
        PasswordHash  NVARCHAR(255) NOT NULL,
        Role          NVARCHAR(50) NOT NULL,   -- admin | operator | viewer
        IsActive      BIT NOT NULL DEFAULT 1,
        CreatedAt     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

-- JOB LOG
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'log_SyncLog')
BEGIN
    CREATE TABLE dbo.log_SyncLog (
        LogId         INT IDENTITY PRIMARY KEY,
        UserId        INT NOT NULL,
        Endpoint      NVARCHAR(50),
        SyncTime      DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        SqlCode       NVARCHAR(100) NOT NULL,
        RecordsLoaded INT NOT NULL,
        Status        NVARCHAR(50) NOT NULL,    -- success | failure
        Message       NVARCHAR(MAX) NULL,       -- detailed system msg
        FOREIGN KEY (UserId) REFERENCES dbo.auth_User(UserId)
    );
END
GO

-- SYNC JOB HISTORY (required by sap-b1-adapter-service)
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'logs_SyncJobs')
BEGIN
    CREATE TABLE dbo.logs_SyncJobs (
        job_id        BIGINT IDENTITY PRIMARY KEY,
        started_at    DATETIME2 NOT NULL,
        finished_at   DATETIME2,
        status        NVARCHAR(20),
        source_query  NVARCHAR(100),
        target_table  NVARCHAR(100),
        rows_written  INT,
        error_message NVARCHAR(MAX),
        endpoint      NVARCHAR(MAX),
        username      NVARCHAR(100)
    );
END
ELSE IF NOT EXISTS (
    SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = 'logs_SyncJobs' AND COLUMN_NAME = 'username'
)
BEGIN
    ALTER TABLE dbo.logs_SyncJobs ADD username NVARCHAR(100) NULL;
END
GO

-- WORK TABLES
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'wrk_TableDesc')
BEGIN
    CREATE TABLE wrk_TableDesc (
        table_id     INT IDENTITY PRIMARY KEY,
        table_name   NVARCHAR(255) NOT NULL,
        owner        NVARCHAR(50)  NOT NULL,   -- qry | cln
        description  NVARCHAR(200),
        is_active    BIT NOT NULL DEFAULT 1,
        created_at   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'wrk_QueryDef')
BEGIN
    CREATE TABLE wrk_QueryDef (
        query_id                  INT IDENTITY PRIMARY KEY,
        query_name                NVARCHAR(100) NOT NULL,
        base_table                NVARCHAR(255) NOT NULL,
        force_lables              NVARCHAR(MAX),             -- FORCE_LABELS (legacy)
        sql_original              NVARCHAR(MAX) NULL,        -- raw SQL as typed by user
        sql_b1_comp_base_query    NVARCHAR(MAX) NULL,        -- preprocessed for SAP B1 API
        sql_b1_comp_extra_options NVARCHAR(MAX) NULL,        -- JSON: computed columns list
        is_active                 BIT NOT NULL DEFAULT 1,
        created_at                DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    );
END
ELSE
BEGIN
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'sql_original')
        ALTER TABLE dbo.wrk_QueryDef ADD sql_original NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'sql_b1_comp_base_query')
        ALTER TABLE dbo.wrk_QueryDef ADD sql_b1_comp_base_query NVARCHAR(MAX) NULL;
    IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'sql_b1_comp_extra_options')
        ALTER TABLE dbo.wrk_QueryDef ADD sql_b1_comp_extra_options NVARCHAR(MAX) NULL;
END
GO
