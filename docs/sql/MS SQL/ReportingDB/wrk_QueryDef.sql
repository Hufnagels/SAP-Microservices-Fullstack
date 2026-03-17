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

INSERT INTO [dbo].[wrk_QueryDef] ([query_id], [query_name], [base_table], [sql_original], [force_lables], [is_active], [created_at], [username], [description], [sql_b1_comp_base_query], [sql_b1_comp_extra_options], [service_name]) VALUES
('1', N'My_OpenOrders', N'qry_SalesOrders', N'SELECT TOP 100
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
ORDER BY T0.DocDate DESC, T0.DocNum DESC', NULL, '1', '2026-03-14 11:59:34.8500000', N'admin', N'Nyitott vevői rendelések', N'SELECT
    TOP 100
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
ORDER BY T0.DocDate DESC, T0.DocNum DESC', N'[]', N'orders-service'),
('3', N'Raktarkeszlet_ALAP_aktualis', N'', N'SELECT
	T0.ItemCode AS ''Cikkszám'',
	T2.ItemName AS ''Megnevezés'',
	T0.WhsCode AS ''Raktár'',
	T1.InDate AS ''Bevételezve'',
	T1.DistNumber AS ''Sarzs szám'',
	T2.SalUnitMsr AS ''Egység'',
	T0.Quantity AS ''Raktáron lévő mennyiség'',

	
FROM
	OBTQ T0 -- Batch quantities by warehouse and bin
	INNER JOIN OBTN T1 ON T0.ItemCode = T1.ItemCode AND T0.SysNumber = T1.SysNumber
	INNER JOIN OITM T2 ON T0.ItemCode = T2.ItemCode
WHERE
	T0.WhsCode = ''ALAP'' -- Csak a késztermék raktár
	AND T0.Quantity > 0
ORDER BY
	T0.ItemCode,
	T0.WhsCode,
	T1.DistNumber', NULL, '1', '2026-03-14 12:37:02.5433333', N'admin', N'Raktarkeszlet_ALAP_aktualis', N'SELECT
    T0.ItemCode AS CikkszM,
    T2.ItemName AS MegnevezS,
    T0.WhsCode AS RaktR,
    T1.InDate AS BevTelezve,
    T1.DistNumber AS SarzsSzM,
    T2.SalUnitMsr AS EgysG,
    T0.Quantity AS RaktRonLVMennyisG
FROM
	OBTQ T0
	INNER JOIN OBTN T1 ON T0.ItemCode = T1.ItemCode AND T0.SysNumber = T1.SysNumber
	INNER JOIN OITM T2 ON T0.ItemCode = T2.ItemCode
WHERE
	T0.WhsCode = ''ALAP''
	AND T0.Quantity > 0
ORDER BY
	T0.ItemCode,
	T0.WhsCode,
	T1.DistNumber', N'[]', N'inventory-service'),
('5', N'Items custom fields', N'qry_ItemsCF', N'SELECT 
  T0.ItemCode,
  T1.ItemName,
  T0.OnHand,
  T1.U_BRD_ALAPANYAGCIKK,
  T1.U_NTT_ALAPANYAG,
  T1.U_NTT_ATMERO,
  T1.U_NTT_CIMKE,
  T1.U_NTT_DUDA,
  T1.U_NTT_EGYEBINFO,
  T1.U_NTT_GRAMMSULY,
  T1.U_NTT_HOSSZM,
  -- T1.U_NTT_PAPIRMINOSEG,
  T1.U_NTT_PAPIRTYPE,
  T1.U_NTT_PERFOR,
  T1.U_NTT_RAKLAPOZAS,
  T1.U_NTT_RETEG,
  T1.U_NTT_TEKERCSSZAM,
  T1.U_NTT_TEKMERET,
  T1.U_NTT_VAGAS,
  T1.U_NTT_PAPIRMINOSEG,
  -- T1.U_BRD_Robotprogram_szama,
  -- T1.U_BRD_Nagyrobot_korrekcio,
  -- T1.U_BRD_Kisrobot_korrekcio,
  T1.SalPackUn,
  -- T1.U_BRD_Raklap_Alap,
  -- T1.U_BRD_Raklap_Magas,
  -- T1.U_BRD_Raklap_zsugorsor,
  -- T1.U_BRD_CIKK_EGYEDI_AZONOSITO,
  -- T1.U_NTT_CIMKE,
  -- T1.U_BRD_Cimke_meret,
  -- T1.U_BRD_Cimke_tipusa,
  T1.PicturName,
  -- T1.U_NTT_RAKLAPOZAS,
  -- T1.U_BRD_Raklap_zsugorszam,
  T1.UserText,
  T1.SWeight1,
  T1.IWeight1,
  T1.SHeight1,
  T1.SWidth1,
  T1.SLength1
  
FROM OITW T0
  INNER JOIN OITM T1 on T1.ItemCode = T0.ItemCode 
WHERE T0.WhsCode = ''KT'' and T0.Onhand >0', NULL, '1', '2026-03-16 19:05:45.4400000', N'admin', N'Cikktörzs késztermékre egyedi mezőkkel', N'SELECT
    T0.ItemCode AS ItemCode,
    T1.ItemName AS ItemName,
    T0.OnHand AS OnHand,
    T1.U_BRD_ALAPANYAGCIKK AS U_BRD_ALAPANYAGCIKK,
    T1.U_NTT_ALAPANYAG AS U_NTT_ALAPANYAG,
    T1.U_NTT_ATMERO AS U_NTT_ATMERO,
    T1.U_NTT_CIMKE AS U_NTT_CIMKE,
    T1.U_NTT_DUDA AS U_NTT_DUDA,
    T1.U_NTT_EGYEBINFO AS U_NTT_EGYEBINFO,
    T1.U_NTT_GRAMMSULY AS U_NTT_GRAMMSULY,
    T1.U_NTT_HOSSZM AS U_NTT_HOSSZM,
    T1.U_NTT_PAPIRTYPE AS U_NTT_PAPIRTYPE,
    T1.U_NTT_PERFOR AS U_NTT_PERFOR,
    T1.U_NTT_RAKLAPOZAS AS U_NTT_RAKLAPOZAS,
    T1.U_NTT_RETEG AS U_NTT_RETEG,
    T1.U_NTT_TEKERCSSZAM AS U_NTT_TEKERCSSZAM,
    T1.U_NTT_TEKMERET AS U_NTT_TEKMERET,
    T1.U_NTT_VAGAS AS U_NTT_VAGAS,
    T1.U_NTT_PAPIRMINOSEG AS U_NTT_PAPIRMINOSEG,
    T1.SalPackUn AS SalPackUn,
    T1.PicturName AS PicturName,
    T1.UserText AS UserText,
    T1.SWeight1 AS SWeight1,
    T1.IWeight1 AS IWeight1,
    T1.SHeight1 AS SHeight1,
    T1.SWidth1 AS SWidth1,
    T1.SLength1 AS SLength1
FROM OITW T0
  INNER JOIN OITM T1 on T1.ItemCode = T0.ItemCode 
WHERE T0.WhsCode = ''KT'' and T0.Onhand >0', N'[]', N'inventory-service');
