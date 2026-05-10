USE master;
GO

IF NOT EXISTS (SELECT 1 FROM sys.sql_logins WHERE name = N'<ADMINUSER>')
BEGIN
    CREATE LOGIN [<ADMINUSER>]
        WITH PASSWORD = 'xxxxxxxx',
        CHECK_POLICY = ON,
        CHECK_EXPIRATION = ON;
END
GO

IF DB_ID(N'ReportingDB') IS NULL
    CREATE DATABASE [ReportingDB];
GO

USE [ReportingDB];
GO

IF NOT EXISTS (SELECT 1 FROM sys.database_principals WHERE name = N'<ADMINUSER>')
BEGIN
    CREATE USER [<ADMINUSER>] FOR LOGIN [<ADMINUSER>];
    ALTER ROLE db_owner ADD MEMBER [<ADMINUSER>];
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
        finished_at   DATETIME2 NULL,
        status        NVARCHAR(20) NULL,
        source_query  NVARCHAR(100) NULL,
        target_table  NVARCHAR(100) NULL,
        rows_written  INT NULL,
        error_message NVARCHAR(MAX) NULL,
        endpoint      NVARCHAR(MAX) NULL,
        username      NVARCHAR(200) NULL,
        sync_type     NVARCHAR(20) NULL
    );
END
GO

-- Add missing columns to logs_SyncJobs if upgrading from older schema
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'logs_SyncJobs' AND COLUMN_NAME = 'username')
    ALTER TABLE dbo.logs_SyncJobs ADD username NVARCHAR(200) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'logs_SyncJobs' AND COLUMN_NAME = 'sync_type')
    ALTER TABLE dbo.logs_SyncJobs ADD sync_type NVARCHAR(20) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'logs_SyncJobs' AND COLUMN_NAME = 'rows_written')
    ALTER TABLE dbo.logs_SyncJobs ADD rows_written INT NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'logs_SyncJobs' AND COLUMN_NAME = 'error_message')
    ALTER TABLE dbo.logs_SyncJobs ADD error_message NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'logs_SyncJobs' AND COLUMN_NAME = 'finished_at')
    ALTER TABLE dbo.logs_SyncJobs ADD finished_at DATETIME2 NULL;
GO

-- WORK TABLES
IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'wrk_TableDesc')
BEGIN
    CREATE TABLE dbo.wrk_TableDesc (
        table_id     INT IDENTITY PRIMARY KEY,
        table_name   NVARCHAR(255) NOT NULL,
        owner        NVARCHAR(50)  NOT NULL,
        description  NVARCHAR(200) NULL,
        is_active    BIT NOT NULL DEFAULT 1,
        created_at   DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT UQ_wrk_TableDesc_table_name UNIQUE (table_name)
    );
END
GO

-- Add UNIQUE constraint to wrk_TableDesc.table_name if upgrading from older schema
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.wrk_TableDesc')
      AND name = 'UQ_wrk_TableDesc_table_name'
)
    ALTER TABLE dbo.wrk_TableDesc
        ADD CONSTRAINT UQ_wrk_TableDesc_table_name UNIQUE (table_name);
GO

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'wrk_QueryDef')
BEGIN
    CREATE TABLE dbo.wrk_QueryDef (
        query_id                  INT IDENTITY PRIMARY KEY,
        query_name                NVARCHAR(100) NOT NULL,
        base_table                NVARCHAR(255) NULL,          -- NULL when dst is EXCEL
        description               NVARCHAR(MAX) NULL,
        service_name              NVARCHAR(200) NULL,
        force_lables              NVARCHAR(MAX) NULL,          -- legacy
        sql_original              NVARCHAR(MAX) NULL,          -- raw SQL as typed by user
        sql_b1_comp_base_query    NVARCHAR(MAX) NULL,          -- preprocessed for SAP B1 API
        sql_b1_comp_extra_options NVARCHAR(MAX) NULL,          -- JSON: computed columns list
        is_active                 BIT NOT NULL DEFAULT 1,
        created_by                NVARCHAR(100) NULL,
        updated_by                NVARCHAR(100) NULL,
        updated_at                DATETIME2 NULL,
        created_at                DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
        CONSTRAINT FK_wrk_QueryDef_base_table
            FOREIGN KEY (base_table) REFERENCES dbo.wrk_TableDesc (table_name)
    );
END
GO

-- Add missing columns to wrk_QueryDef if upgrading from older schema
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'sql_original')
    ALTER TABLE dbo.wrk_QueryDef ADD sql_original NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'sql_b1_comp_base_query')
    ALTER TABLE dbo.wrk_QueryDef ADD sql_b1_comp_base_query NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'sql_b1_comp_extra_options')
    ALTER TABLE dbo.wrk_QueryDef ADD sql_b1_comp_extra_options NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'description')
    ALTER TABLE dbo.wrk_QueryDef ADD description NVARCHAR(MAX) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'service_name')
    ALTER TABLE dbo.wrk_QueryDef ADD service_name NVARCHAR(200) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'created_by')
    ALTER TABLE dbo.wrk_QueryDef ADD created_by NVARCHAR(100) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'updated_by')
    ALTER TABLE dbo.wrk_QueryDef ADD updated_by NVARCHAR(100) NULL;
IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'wrk_QueryDef' AND COLUMN_NAME = 'updated_at')
    ALTER TABLE dbo.wrk_QueryDef ADD updated_at DATETIME2 NULL;

-- Make base_table nullable if it was created NOT NULL in an older version
IF EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.wrk_QueryDef')
      AND name = 'base_table'
      AND is_nullable = 0
)
    ALTER TABLE dbo.wrk_QueryDef ALTER COLUMN base_table NVARCHAR(255) NULL;

-- Add FK if missing (only possible after base_table is nullable and UQ constraint exists)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_wrk_QueryDef_base_table')
    ALTER TABLE dbo.wrk_QueryDef
        ADD CONSTRAINT FK_wrk_QueryDef_base_table
        FOREIGN KEY (base_table) REFERENCES dbo.wrk_TableDesc (table_name);
GO

-- ============================================================
-- SEED DATA  (idempotent — skipped if rows already exist)
-- ============================================================

-- auth_User: default admin account  (password: xxxxxxxx) --- IGNORE ---
IF NOT EXISTS (SELECT 1 FROM dbo.auth_User WHERE Username = '<ADMINUSER>')
    INSERT INTO dbo.auth_User (Username, PasswordHash, Role, IsActive)
    VALUES (
        '<ADMINUSER>',
        '$2b$12$KIXDwjBjcFa6e3e5R1N8ROefANT8p7C3ZqY2fL0kLw1Wx3TqQlQ7e',  -- bcrypt of xxxxxxxx
        'admin',
        1
    );
GO

-- wrk_TableDesc: destination table catalogue
MERGE dbo.wrk_TableDesc AS t
USING (VALUES
    ('SAP_BusinessPartners', '<ADMINUSER>', 'Business partners synced from SAP B1 (CardCode, CardName, etc.)'),
    ('SAP_SalesOrders',      '<ADMINUSER>', 'Open and closed sales orders from SAP B1 ORDR'),
    ('SAP_OpenItems',        '<ADMINUSER>', 'Ageing open A/R items from SAP B1 OINV'),
    ('SAP_Inventory',        '<ADMINUSER>', 'Current warehouse stock levels from SAP B1 OITW'),
    ('SAP_PurchaseOrders',   '<ADMINUSER>', 'Purchase orders from SAP B1 OPOR')
) AS s (table_name, owner, description)
ON t.table_name = s.table_name
WHEN NOT MATCHED THEN
    INSERT (table_name, owner, description, is_active)
    VALUES (s.table_name, s.owner, s.description, 1);
GO

-- wrk_QueryDef: pre-configured sync query definitions
-- Insert only rows whose query_name does not already exist
INSERT INTO dbo.wrk_QueryDef
    (query_name, base_table, description, service_name,
     sql_original, sql_b1_comp_base_query, sql_b1_comp_extra_options,
     is_active, created_by)
SELECT s.query_name, s.base_table, s.description, s.service_name,
       s.sql_original, s.sql_b1_comp_base_query, s.sql_b1_comp_extra_options,
       1, '<ADMINUSER>'
FROM (VALUES
    (
        'BusinessPartners_Full',
        'SAP_BusinessPartners',
        'All active business partners with address and contact info',
        'sap-b1-adapter',
        'SELECT T0.CardCode, T0.CardName, T0.CardType, T0.GroupCode, T0.Phone1, T0.E_Mail, T0.City, T0.Country, T0.Balance, T0.Active FROM OCRD T0 WHERE T0.Active = ''Y''',
        'SELECT T0."CardCode", T0."CardName", T0."CardType", T0."GroupCode", T0."Phone1", T0."E_Mail", T0."City", T0."Country", T0."Balance", T0."Active" FROM OCRD T0 WHERE T0."Active" = ''Y''',
        NULL
    ),
    (
        'SalesOrders_Open',
        'SAP_SalesOrders',
        'Open sales orders with document total and delivery date',
        'sap-b1-adapter',
        'SELECT T0.DocNum, T0.DocDate, T0.CardCode, T0.CardName, T0.DocTotal, T0.DocCur, T0.DocDueDate, T0.NumAtCard FROM ORDR T0 WHERE T0.DocStatus = ''O''',
        'SELECT T0."DocNum", T0."DocDate", T0."CardCode", T0."CardName", T0."DocTotal", T0."DocCur", T0."DocDueDate", T0."NumAtCard" FROM ORDR T0 WHERE T0."DocStatus" = ''O''',
        NULL
    ),
    (
        'OpenInvoices_Ageing',
        'SAP_OpenItems',
        'Open A/R invoices with days overdue (computed column)',
        'sap-b1-adapter',
        'SELECT T0.DocNum, T0.DocDate, T0.CardCode, T0.CardName, T0.DocTotal, T0.PaidToDate, T0.DocTotal - T0.PaidToDate AS OpenAmount, T0.DocDueDate FROM OINV T0 WHERE T0.DocStatus = ''O''',
        'SELECT T0."DocNum", T0."DocDate", T0."CardCode", T0."CardName", T0."DocTotal", T0."PaidToDate", T0."DocTotal" - T0."PaidToDate" AS "OpenAmount", T0."DocDueDate" FROM OINV T0 WHERE T0."DocStatus" = ''O''',
        '{"computed": ["OpenAmount"]}'
    ),
    (
        'Inventory_Stock',
        'SAP_Inventory',
        'Current on-hand stock per item per warehouse',
        'sap-b1-adapter',
        'SELECT T0.ItemCode, T1.ItemName, T0.WhsCode, T0.OnHand, T0.IsCommited, T0.OnOrder FROM OITW T0 INNER JOIN OITM T1 ON T0.ItemCode = T1.ItemCode WHERE T0.OnHand <> 0',
        'SELECT T0."ItemCode", T1."ItemName", T0."WhsCode", T0."OnHand", T0."IsCommited", T0."OnOrder" FROM OITW T0 INNER JOIN OITM T1 ON T0."ItemCode" = T1."ItemCode" WHERE T0."OnHand" <> 0',
        NULL
    ),
    (
        'PurchaseOrders_Open',
        'SAP_PurchaseOrders',
        'Open purchase orders awaiting delivery',
        'sap-b1-adapter',
        'SELECT T0.DocNum, T0.DocDate, T0.CardCode, T0.CardName, T0.DocTotal, T0.DocCur, T0.DocDueDate FROM OPOR T0 WHERE T0.DocStatus = ''O''',
        'SELECT T0."DocNum", T0."DocDate", T0."CardCode", T0."CardName", T0."DocTotal", T0."DocCur", T0."DocDueDate" FROM OPOR T0 WHERE T0."DocStatus" = ''O''',
        NULL
    )
) AS s (query_name, base_table, description, service_name,
        sql_original, sql_b1_comp_base_query, sql_b1_comp_extra_options)
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.wrk_QueryDef WHERE query_name = s.query_name
);
GO

-- logs_SyncJobs: two seed entries showing expected row shape (no auto-rows on real runs)
IF NOT EXISTS (SELECT 1 FROM dbo.logs_SyncJobs)
    INSERT INTO dbo.logs_SyncJobs
        (started_at, finished_at, status, source_query, target_table,
         rows_written, endpoint, username, sync_type)
    VALUES
        (DATEADD(day,-1,SYSDATETIME()), DATEADD(day,-1,SYSDATETIME()), 'SUCCESS',
         'BusinessPartners_Full', 'SAP_BusinessPartners', 142,
         '/sap/sync', '<ADMINUSER>', 'sync'),
        (SYSDATETIME(), SYSDATETIME(), 'SUCCESS',
         'SalesOrders_Open', 'SAP_SalesOrders', 37,
         '/sap/sync-async', '<ADMINUSER>', 'async');
GO
