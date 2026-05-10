-- ReportingDB · dbo.wrk_TableDesc
-- SQL Server 2022 import script (converted from Azure SQL Edge TablePlus export)
-- Generated: 2026-05-09

USE [ReportingDB];
GO

IF OBJECT_ID('dbo.wrk_QueryDef',  'U') IS NOT NULL DROP TABLE [dbo].[wrk_QueryDef];
IF OBJECT_ID('dbo.wrk_TableDesc', 'U') IS NOT NULL DROP TABLE [dbo].[wrk_TableDesc];
GO

CREATE TABLE [dbo].[wrk_TableDesc] (
    [table_id]    INT           IDENTITY(1,1) NOT NULL,
    [table_name]  NVARCHAR(255) NOT NULL,
    [owner]       NVARCHAR(50)  NOT NULL,
    [description] NVARCHAR(200) NULL,
    [is_active]   BIT           NOT NULL DEFAULT (1),
    [created_at]  DATETIME2(7)  NOT NULL DEFAULT (SYSDATETIME()),
    CONSTRAINT [PK_wrk_TableDesc]              PRIMARY KEY ([table_id]),
    CONSTRAINT [UQ_wrk_TableDesc_table_name]   UNIQUE      ([table_name])
);
GO

SET IDENTITY_INSERT [dbo].[wrk_TableDesc] ON;
GO

INSERT INTO [dbo].[wrk_TableDesc]
    ([table_id], [table_name], [owner], [description], [is_active], [created_at])
VALUES
    (1, N'wrk_Test',                N'admin', N'test',                                    0, '2026-03-29 15:34:41.1933333'),
    (2, N'qry_SalesOrders',         N'admin', N'Simple Sales Order query with open pcs',  1, '2026-03-29 15:35:08.3533333'),
    (3, N'wrk_TestTable',           N'admin', N'test table creation',                     0, '2026-03-29 16:20:42.5900000'),
    (4, N'qry_ItemListUniqueFields',N'admin', N'Item table filtered for unique fields',   1, '2026-03-29 19:43:14.9333333');
GO

SET IDENTITY_INSERT [dbo].[wrk_TableDesc] OFF;
GO

DBCC CHECKIDENT ('dbo.wrk_TableDesc', RESEED, 4);
GO
