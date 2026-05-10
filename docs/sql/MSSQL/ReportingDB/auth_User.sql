-- ReportingDB · dbo.auth_User
-- SQL Server 2022 import script (converted from Azure SQL Edge TablePlus export)
-- Generated: 2026-05-09

USE [ReportingDB];
GO

IF OBJECT_ID('dbo.auth_User', 'U') IS NOT NULL
    DROP TABLE [dbo].[auth_User];
GO

CREATE TABLE [dbo].[auth_User] (
    [UserId]       INT           IDENTITY(1,1) NOT NULL,
    [Username]     NVARCHAR(100) NOT NULL,
    [PasswordHash] NVARCHAR(255) NOT NULL,
    [Role]         NVARCHAR(50)  NOT NULL,
    [IsActive]     BIT           NOT NULL DEFAULT (1),
    [CreatedAt]    DATETIME2(7)  NOT NULL DEFAULT (SYSDATETIME()),
    CONSTRAINT [PK_auth_User] PRIMARY KEY ([UserId]),
    CONSTRAINT [UQ_auth_User_Username] UNIQUE ([Username])
);
GO
