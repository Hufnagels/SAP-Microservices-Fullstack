-- ReportingDB · dbo.wrk_QueryDef
-- SQL Server 2022 import script (converted from Azure SQL Edge TablePlus export)
-- Depends on: wrk_TableDesc.sql (run first)
-- Generated: 2026-05-09

USE [ReportingDB];
GO

IF OBJECT_ID('dbo.wrk_QueryDef', 'U') IS NOT NULL
    DROP TABLE [dbo].[wrk_QueryDef];
GO

CREATE TABLE [dbo].[wrk_QueryDef] (
    [query_id]                  INT           IDENTITY(1,1) NOT NULL,
    [query_name]                NVARCHAR(100) NOT NULL,
    [base_table]                NVARCHAR(255) NULL,
    [force_lables]              NVARCHAR(MAX) NULL,
    [sql_original]              NVARCHAR(MAX) NULL,
    [sql_b1_comp_base_query]    NVARCHAR(MAX) NULL,
    [sql_b1_comp_extra_options] NVARCHAR(MAX) NULL,
    [is_active]                 BIT           NOT NULL DEFAULT (1),
    [created_at]                DATETIME2(7)  NOT NULL DEFAULT (SYSDATETIME()),
    [created_by]                NVARCHAR(100) NULL,
    [updated_by]                NVARCHAR(100) NULL,
    [updated_at]                DATETIME2(7)  NULL,
    [service_name]              NVARCHAR(200) NULL,
    [description]               NVARCHAR(MAX) NULL,
    CONSTRAINT [PK_wrk_QueryDef]          PRIMARY KEY ([query_id]),
    CONSTRAINT [FK_wrk_QueryDef_base_table]
        FOREIGN KEY ([base_table]) REFERENCES [dbo].[wrk_TableDesc] ([table_name])
);
GO

SET IDENTITY_INSERT [dbo].[wrk_QueryDef] ON;
GO

INSERT INTO [dbo].[wrk_QueryDef]
    ([query_id], [query_name], [base_table], [force_lables],
     [sql_original], [sql_b1_comp_base_query], [sql_b1_comp_extra_options],
     [is_active], [created_at], [created_by], [updated_by], [updated_at],
     [service_name], [description])
VALUES
(2, N'TestQuery', N'wrk_Test', NULL,
 N'SELECT * FROM OVPM',
 N'SELECT
    *
FROM OVPM',
 N'[]', 0, '2026-03-29 15:34:41.2333333', N'admin', NULL, NULL, NULL, N'test'),

(3, N'qrySalesOrdersSimple', N'qry_SalesOrders', NULL,
 N'SELECT TOP 100
  T0.DocNum,
  T0.DocDate,
  T0.CardCode,
  T0.CardName,
  T1.ItemCode,
  T1.Dscription,
  T1.Quantity,
  T1.OpenQty
FROM ORDR T0
JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry
WHERE T0.DocStatus = ''O''
ORDER BY T0.DocDate DESC, T0.DocNum DESC',
 N'SELECT
    TOP 100
  T0.DocNum,
    T0.DocDate AS DocDate,
    T0.CardCode AS CardCode,
    T0.CardName AS CardName,
    T1.ItemCode AS ItemCode,
    T1.Dscription AS Dscription,
    T1.Quantity AS Quantity,
    T1.OpenQty AS OpenQty
FROM ORDR T0
JOIN RDR1 T1 ON T0.DocEntry = T1.DocEntry
WHERE T0.DocStatus = ''O''
ORDER BY T0.DocDate DESC, T0.DocNum DESC',
 N'[]', 1, '2026-03-29 15:35:08.3600000', N'admin', N'admin', '2026-03-30 09:33:34.2400000',
 N'reporting-service', N'Simple Sales Order query with open pcs'),

(4, N'TestTableCreate', N'wrk_TestTable', NULL,
 N'SELECT DocNum, CardCode FROM ORDR',
 N'SELECT
    DocNum,
    CardCode
FROM ORDR',
 N'[]', 0, '2026-03-29 16:20:42.6066666', N'admin', NULL, NULL, NULL, N'test table creation'),

(5, N'ItemListUniqueFields', N'qry_ItemListUniqueFields', NULL,
 N'SELECT
    S.ItemCode,
    T.ItemName,
    S.WhsCode,
    S.OnHand,
    T.UserText,
    T.SWeight1,
    T.U_BRD_ALAPANYAGCIKK,
    T.U_NTT_ALAPANYAG,
    T.U_NTT_ATMERO,
    T.U_NTT_CIMKE,
    T.U_NTT_DUDA,
    T.U_NTT_EGYEBINFO,
    T.U_NTT_GRAMMSULY,
    T.U_NTT_HOSSZM,
    T.U_NTT_PAPIRMINOSEG,
    T.U_NTT_PAPIRTYPE,
    T.U_NTT_PERFOR,
    T.U_NTT_RAKLAPOZAS,
    T.U_NTT_RETEG,
    T.U_NTT_TEKERCSSZAM,
    T.U_NTT_TEKMERET,
    T.U_NTT_VAGAS,
    T.U_BRD_Robotprogram_szama,
    T.U_BRD_Nagyrobot_korrekcio,
    T.U_BRD_Kisrobot_korrekcio,
    T.U_BRD_Raklap_Alap,
    T.U_BRD_Raklap_Magas,
    T.U_BRD_Raklap_zsugorsor,
    T.U_BRD_CIKK_EGYEDI_AZONOSITO,
    T.U_BRD_Cimke_meret,
    T.U_BRD_Cimke_tipusa,
    T.U_BRD_Raklap_zsugorszam
FROM OITW S
INNER JOIN OITM T ON S.ItemCode = T.ItemCode
WHERE S.ItemCode LIKE ''K%'' AND S.WhsCode = ''KT''
ORDER BY S.ItemCode',
 N'SELECT
    S.ItemCode AS ItemCode,
    T.ItemName AS ItemName,
    S.WhsCode AS WhsCode,
    S.OnHand AS OnHand,
    T.UserText AS UserText,
    T.SWeight1 AS SWeight1,
    T.U_BRD_ALAPANYAGCIKK AS U_BRD_ALAPANYAGCIKK,
    T.U_NTT_ALAPANYAG AS U_NTT_ALAPANYAG,
    T.U_NTT_ATMERO AS U_NTT_ATMERO,
    T.U_NTT_CIMKE AS U_NTT_CIMKE,
    T.U_NTT_DUDA AS U_NTT_DUDA,
    T.U_NTT_EGYEBINFO AS U_NTT_EGYEBINFO,
    T.U_NTT_GRAMMSULY AS U_NTT_GRAMMSULY,
    T.U_NTT_HOSSZM AS U_NTT_HOSSZM,
    T.U_NTT_PAPIRMINOSEG AS U_NTT_PAPIRMINOSEG,
    T.U_NTT_PAPIRTYPE AS U_NTT_PAPIRTYPE,
    T.U_NTT_PERFOR AS U_NTT_PERFOR,
    T.U_NTT_RAKLAPOZAS AS U_NTT_RAKLAPOZAS,
    T.U_NTT_RETEG AS U_NTT_RETEG,
    T.U_NTT_TEKERCSSZAM AS U_NTT_TEKERCSSZAM,
    T.U_NTT_TEKMERET AS U_NTT_TEKMERET,
    T.U_NTT_VAGAS AS U_NTT_VAGAS,
    T.U_BRD_Robotprogram_szama AS U_BRD_Robotprogram_szama,
    T.U_BRD_Nagyrobot_korrekcio AS U_BRD_Nagyrobot_korrekcio,
    T.U_BRD_Kisrobot_korrekcio AS U_BRD_Kisrobot_korrekcio,
    T.U_BRD_Raklap_Alap AS U_BRD_Raklap_Alap,
    T.U_BRD_Raklap_Magas AS U_BRD_Raklap_Magas,
    T.U_BRD_Raklap_zsugorsor AS U_BRD_Raklap_zsugorsor,
    T.U_BRD_CIKK_EGYEDI_AZONOSITO AS U_BRD_CIKK_EGYEDI_AZONOSITO,
    T.U_BRD_Cimke_meret AS U_BRD_Cimke_meret,
    T.U_BRD_Cimke_tipusa AS U_BRD_Cimke_tipusa,
    T.U_BRD_Raklap_zsugorszam AS U_BRD_Raklap_zsugorszam
FROM OITW S
INNER JOIN OITM T ON S.ItemCode = T.ItemCode
WHERE S.ItemCode LIKE ''K%'' AND S.WhsCode = ''KT''
ORDER BY S.ItemCode',
 N'[]', 1, '2026-03-29 19:43:14.9633333', N'admin', N'admin', '2026-03-30 10:10:42.1766666',
 N'inventory-service', N'Item table filtered for unique fields'),

(6, N'ItemTest', NULL, NULL,
 N'SELECT S.ItemCode, COUNT(*) AS Cnt
FROM OITW S
INNER JOIN OITM T ON S.ItemCode = T.ItemCode
WHERE S.ItemCode LIKE ''K%'' AND S.WhsCode = ''KT''
GROUP BY S.ItemCode
HAVING COUNT(*) > 1',
 N'SELECT
    S.ItemCode AS ItemCode,
    COUNT(*) AS Cnt
FROM OITW S
INNER JOIN OITM T ON S.ItemCode = T.ItemCode
WHERE S.ItemCode LIKE ''K%'' AND S.WhsCode = ''KT''
GROUP BY S.ItemCode
HAVING COUNT(*) > 1',
 N'[]', 1, '2026-03-30 10:02:32.5766666', N'admin', N'admin', '2026-03-30 10:07:42.4700000',
 N'reporting-service', N'Test for WhsCode - list only 1');
GO

SET IDENTITY_INSERT [dbo].[wrk_QueryDef] OFF;
GO

DBCC CHECKIDENT ('dbo.wrk_QueryDef', RESEED, 6);
GO
