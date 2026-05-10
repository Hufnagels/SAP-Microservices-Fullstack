-- ReportingDB · dbo.logs_SyncJobs
-- SQL Server 2022 import script (converted from Azure SQL Edge TablePlus export)
-- Generated: 2026-05-09

USE [ReportingDB];
GO

IF OBJECT_ID('dbo.logs_SyncJobs', 'U') IS NOT NULL
    DROP TABLE [dbo].[logs_SyncJobs];
GO

CREATE TABLE [dbo].[logs_SyncJobs] (
    [job_id]        BIGINT        IDENTITY(1,1) NOT NULL,
    [started_at]    DATETIME2(7)  NULL,
    [finished_at]   DATETIME2(7)  NULL,
    [status]        NVARCHAR(20)  NULL,
    [source_query]  NVARCHAR(100) NULL,
    [target_table]  NVARCHAR(100) NULL,
    [rows_written]  INT           NULL,
    [error_message] NVARCHAR(MAX) NULL,
    [endpoint]      NVARCHAR(MAX) NULL,
    [username]      NVARCHAR(200) NULL,
    [sync_type]     NVARCHAR(20)  NULL,
    CONSTRAINT [PK_logs_SyncJobs] PRIMARY KEY ([job_id])
);
GO

SET IDENTITY_INSERT [dbo].[logs_SyncJobs] ON;
GO

INSERT INTO [dbo].[logs_SyncJobs]
    ([job_id],[started_at],[finished_at],[status],[source_query],[target_table],[rows_written],[error_message],[endpoint],[username],[sync_type])
VALUES
(1,  '2026-03-29 15:43:21.4000000','2026-03-29 15:43:51.7600000',N'FAILED',N'qrySalesOrdersSimple',N'dbo.qry_SalesOrders',NULL,N'HTTPSConnectionPool(host=''172.22.248.4'', port=50000): Max retries exceeded with url: /b1s/v1/Login (Caused by ConnectTimeoutError(<HTTPSConnection(host=''172.22.248.4'', port=50000) at 0xffff88db2fd0>, ''Connection to 172.22.248.4 timed out. (connect timeout=30)''))',N'/sap/sync',N'admin',N'sync'),
(2,  '2026-03-29 16:06:44.8933333','2026-03-29 16:06:45.6966666',N'FAILED',N'qrySalesOrdersSimple',N'dbo.qry_SalesOrders',NULL,N'401 Client Error: Unauthorized for url: https://host.docker.internal:50001/b1s/v1/Login',N'/sap/sync',N'admin',N'sync'),
(3,  '2026-03-29 16:07:21.6633333','2026-03-29 16:07:22.1633333',N'FAILED',N'qrySalesOrdersSimple',N'dbo.qry_SalesOrders',NULL,N'401 Client Error: Unauthorized for url: https://host.docker.internal:50001/b1s/v1/Login',N'/sap/sync',N'admin',N'sync'),
(4,  '2026-03-29 16:07:58.3500000','2026-03-29 16:07:58.8100000',N'FAILED',N'qrySalesOrdersSimple',N'dbo.qry_SalesOrders',NULL,N'401 Client Error: Unauthorized for url: https://host.docker.internal:50001/b1s/v1/Login',N'/sap/sync',N'admin',N'sync'),
(5,  '2026-03-29 16:12:52.6300000','2026-03-29 16:12:53.0566666',N'FAILED',N'qrySalesOrdersSimple',N'dbo.qry_SalesOrders',NULL,N'401 Client Error: Unauthorized for url: https://host.docker.internal:50001/b1s/v1/Login',N'/sap/sync',N'admin',N'sync'),
(6,  '2026-03-29 16:24:22.1133333','2026-03-29 16:24:22.9100000',N'FAILED',N'qrySalesOrdersSimple',N'dbo.qry_SalesOrders',NULL,N'401 Client Error: Unauthorized for url: https://host.docker.internal:50001/b1s/v1/Login',N'/sap/sync',N'admin',N'sync'),
(7,  '2026-03-29 16:31:36.8833333','2026-03-29 16:31:37.6600000',N'FAILED',N'qrySalesOrdersSimple',N'dbo.qry_SalesOrders',NULL,N'401 Client Error: Unauthorized for url: https://host.docker.internal:50001/b1s/v1/Login',N'/sap/sync',N'admin',N'sync'),
(8,  '2026-03-29 19:47:48.4133333','2026-03-29 19:47:49.0900000',N'FAILED',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',NULL,N'401 Client Error: Unauthorized for url: https://host.docker.internal:50001/b1s/v1/Login',N'/sap/sync',N'admin',N'sync'),
(9,  '2026-03-30 08:32:55.5466666','2026-03-30 08:32:58.1566666',N'FAILED',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',NULL,N'401 Client Error: Unauthorized for url: https://host.docker.internal:50001/b1s/v1/Login',N'/sap/sync',N'admin',N'sync'),
(10, '2026-03-30 08:36:25.8966666','2026-03-30 08:36:26.7500000',N'FAILED',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',NULL,N'401 Client Error: Unauthorized for url: https://host.docker.internal:50001/b1s/v1/Login',N'/sap/sync',N'admin',N'sync'),
(11, '2026-03-30 08:40:49.1900000','2026-03-30 08:41:19.3200000',N'FAILED',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',NULL,N'HTTPSConnectionPool(host=''172.22.248.4'', port=50000): Max retries exceeded with url: /b1s/v1/Login (Caused by ConnectTimeoutError(<HTTPSConnection(host=''172.22.248.4'', port=50000) at 0xffff8b218dd0>, ''Connection to 172.22.248.4 timed out. (connect timeout=30)''))',N'/sap/sync',N'admin',N'sync'),
(12, '2026-03-30 09:26:06.1500000','2026-03-30 09:26:36.3400000',N'FAILED',N'qrySalesOrdersSimple',N'dbo.qry_SalesOrders',NULL,N'HTTPSConnectionPool(host=''172.22.248.4'', port=50000): Max retries exceeded with url: /b1s/v1/Login (Caused by ConnectTimeoutError(<HTTPSConnection(host=''172.22.248.4'', port=50000) at 0xffff8b2948d0>, ''Connection to 172.22.248.4 timed out. (connect timeout=30)''))',N'/sap/sync',N'admin',N'sync'),
(13, '2026-03-30 09:32:45.0033333','2026-03-30 09:32:46.5166666',N'FAILED',N'qrySalesOrdersSimple',N'dbo.qry_SalesOrders',NULL,N'SAP B1 rejected SQLQuery creation (400): Invalid SQL syntax:, line 3, character position 29, missing FROM at ''szám''',N'/sap/sync',N'admin',N'sync'),
(14, '2026-03-30 09:33:43.1666666','2026-03-30 09:33:45.1400000',N'SUCCESS',N'qrySalesOrdersSimple',N'dbo.qry_SalesOrders',100,NULL,N'/sap/sync',N'admin',N'sync'),
(15, '2026-03-30 09:45:07.9033333','2026-03-30 09:45:09.5600000',N'FAILED',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',NULL,N'SAP B1 rejected SQLQuery creation (400): Invalid SQL syntax:, line 1, character position 0, mismatched input ''/'' expecting {SELECT, ''(''}',N'/sap/sync',N'admin',N'sync'),
(16, '2026-03-30 09:45:56.8700000','2026-03-30 09:46:11.5100000',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',3648,NULL,N'/sap/sync',N'admin',N'sync'),
(17, '2026-03-30 09:47:47.1033333','2026-03-30 09:47:58.0966666',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',3648,NULL,N'/sap/sync',N'admin',N'sync'),
(18, '2026-03-30 09:48:52.5966666','2026-03-30 09:49:03.9366666',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',3648,NULL,N'/sap/sync',N'admin',N'sync'),
(19, '2026-03-30 09:49:42.5833333','2026-03-30 09:49:53.8666666',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',3648,NULL,N'/sap/sync',N'admin',N'sync'),
(20, '2026-03-30 09:51:04.1700000','2026-03-30 09:51:18.3833333',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',3648,NULL,N'/sap/sync',N'admin',N'sync'),
(21, '2026-03-30 09:52:38.2433333','2026-03-30 09:52:49.8466666',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',3648,NULL,N'/sap/sync',N'admin',N'sync'),
(22, '2026-03-30 09:57:56.8633333','2026-03-30 09:58:08.4900000',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',3648,NULL,N'/sap/sync',N'admin',N'sync'),
(23, '2026-03-30 10:02:39.8666666','2026-03-30 10:02:40.9300000',N'FAILED',N'ItemTest',N'EXCEL',NULL,N'SAP B1 rejected SQLQuery creation (400): Invalid SQL syntax:SELECT
    WhsCode,
    COUNT(*)
FROM OITW
WHERE ItemCode LIKE ''K%'' AND WhsCode = ''KT''
GROUP BY WhsCode, line 3, character position 4, Cannot support expression ''COUNT(*)'' without an alias.',N'/sap/queries/preview',N'admin',NULL),
(24, '2026-03-30 10:04:29.4200000','2026-03-30 10:04:30.2666666',N'SUCCESS',N'ItemTest',N'EXCEL',1,NULL,N'/sap/queries/preview',N'admin',NULL),
(25, '2026-03-30 10:05:29.0666666','2026-03-30 10:05:40.2900000',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',3648,NULL,N'/sap/sync',N'admin',N'sync'),
(26, '2026-03-30 10:07:51.1000000','2026-03-30 10:07:51.7733333',N'SUCCESS',N'ItemTest',N'EXCEL',1,NULL,N'/sap/queries/preview',N'admin',NULL),
(27, '2026-03-30 10:09:28.1000000','2026-03-30 10:09:38.6733333',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',3648,NULL,N'/sap/sync',N'admin',N'sync'),
(28, '2026-03-30 10:11:03.3333333','2026-03-30 10:11:13.9566666',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',3648,NULL,N'/sap/sync',N'admin',N'sync'),
(29, '2026-03-30 17:17:06.7700000','2026-03-30 17:17:09.4933333',N'SUCCESS',N'ItemListUniqueFields',N'dbo.qry_ItemListUniqueFields',360,NULL,N'/sap/sync',N'admin',N'sync');
GO

SET IDENTITY_INSERT [dbo].[logs_SyncJobs] OFF;
GO

DBCC CHECKIDENT ('dbo.logs_SyncJobs', RESEED, 29);
GO
