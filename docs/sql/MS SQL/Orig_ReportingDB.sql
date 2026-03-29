CREATE TABLE auth_User (
    user_id        INT IDENTITY PRIMARY KEY,
    username       NVARCHAR(50)  NOT NULL UNIQUE,
    password_hash  NVARCHAR(255) NOT NULL,
    role           NVARCHAR(20)  NOT NULL
        CHECK (role IN ('superadmin','admin','operator','viewer')),
    is_active      BIT NOT NULL DEFAULT 1,
    created_at     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE auth_ApiKey (
    api_key_id     INT IDENTITY PRIMARY KEY,
    api_key_hash   NVARCHAR(255) NOT NULL UNIQUE,
    user_type      NVARCHAR(20) NOT NULL
        CHECK (user_type IN ('superadmin','admin','operator','viewer')),
    user_id        INT NOT NULL UNIQUE,
    is_active      BIT NOT NULL DEFAULT 1,
    description    NVARCHAR(255),
    last_used_at   DATETIME2,
    created_at     DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_authApiKey_user FOREIGN KEY (user_id) REFERENCES auth_User(user_id)
);

CREATE TABLE auth_SyncPolicy (
    policy_id      INT IDENTITY PRIMARY KEY,
    policy_name    NVARCHAR(100) NOT NULL,
    allowed_query  NVARCHAR(100) NOT NULL,   -- qry_*
    allowed_table  NVARCHAR(100) NOT NULL,   -- cln_*
    mode           NVARCHAR(20) NOT NULL
        CHECK (mode IN ('sync','async','scheduled')),
    is_active      BIT NOT NULL DEFAULT 1,
    created_at     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE auth_RowPolicy (
    row_policy_id  INT IDENTITY PRIMARY KEY,
    target_table   NVARCHAR(100) NOT NULL,
    predicate_sql  NVARCHAR(MAX) NOT NULL,
    bind_role      NVARCHAR(20),
    bind_user_id   INT,
    bind_api_key   INT,
    is_active      BIT NOT NULL DEFAULT 1,
    created_at     DATETIME2 NOT NULL DEFAULT SYSDATETIME()
);

CREATE TABLE wrk_TableDesc (
    table_id     INT IDENTITY PRIMARY KEY,
    table_name   NVARCHAR(255) NOT NULL,
    owner        INT NOT NULL,   -- qry | cln
    description  NVARCHAR(200),
    is_active    BIT NOT NULL DEFAULT 1,
    created_at   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    CONSTRAINT FK_wrk_TableDesc_user FOREIGN KEY (owner) REFERENCES auth_User(user_id)
);

CREATE TABLE wrk_QueryDef (
    query_id     INT IDENTITY PRIMARY KEY,
    query_name   NVARCHAR(100) NOT NULL,
    table_id     INT NOT NULL,
    sql_text     NVARCHAR(MAX) NOT NULL,
    is_active    BIT NOT NULL DEFAULT 1,
    created_at   DATETIME2 NOT NULL DEFAULT SYSDATETIME()
    CONSTRAINT FK_wrk_QueryDef_table FOREIGN KEY (table_id) REFERENCES wrk_TableDesc(table_id)
);

CREATE TABLE logs_SyncJobs (
    job_id        BIGINT IDENTITY PRIMARY KEY,
    started_at    DATETIME2 NOT NULL,
    finished_at   DATETIME2,
    status        NVARCHAR(20),
    source_query  NVARCHAR(100),
    target_table  NVARCHAR(100),
    rows_written  INT,
    error_message NVARCHAR(MAX),
    endpoint      NVARCHAR(MAX),
    username	  NVARCHAR(20),
    sync_type	  NVARCHAR(20) DEFAULT 'sync'
    	CONSTRAINT DF_logs_SyncJobs_sync_type DEFAULT 'sync',

    CONSTRAINT CHK_logs_SyncJobs_sync_type
        CHECK (sync_type IN ('sync','async','scheduledsync'))
);

UPDATE logs_SyncJobs
SET sync_type = 'sync'
WHERE sync_type IS NULL;

UPDATE logs_SyncJobs
SET sync_type = 'sync'
WHERE sync_type IS NULL;