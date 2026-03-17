// src/pages/Jobs.tsx

import { useEffect, useMemo, useState } from "react";
import { sapApi } from "../api/client";
import { useSelector } from "react-redux";
import type { RootState } from "../app/store";
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from "material-react-table";
import { Box, Typography, Chip } from "@mui/material";
import { toast } from "react-toastify";

interface SyncJob {
  job_id: number;
  endpoint: string;
  source_query: string;
  target_table: string;
  status: string;
  rows_written: number | null;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  username: string | null;
}

function StatusChip({ status }: { status: string }) {
  const color =
    status === "SUCCESS" ? "success" :
    status === "RUNNING"  ? "warning" :
    status === "FAILED"   ? "error"   : "default";
  return <Chip label={status} color={color} size="small" />;
}

export default function Jobs() {
  const token = useSelector((s: RootState) => s.auth.token);
  const [rows, setRows] = useState<SyncJob[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    sapApi.get<SyncJob[]>("/jobs")
      .then(r => setRows(r.data))
      .catch(() => toast.error("Failed to load job history"))
      .finally(() => setLoading(false));
  }, [token]);

  const columns = useMemo<MRT_ColumnDef<SyncJob>[]>(() => [
    { accessorKey: "job_id",       header: "ID",           size: 70 },
    { accessorKey: "username",     header: "User",         size: 120 },
    { accessorKey: "target_table", header: "Target Table", size: 180 },
    { accessorKey: "source_query", header: "Query Code",   size: 130 },
    {
      accessorKey: "status",
      header: "Status",
      size: 110,
      Cell: ({ cell }) => <StatusChip status={cell.getValue<string>()} />,
    },
    { accessorKey: "rows_written", header: "Rows",     size: 80 },
    { accessorKey: "started_at",   header: "Started",  size: 170 },
    { accessorKey: "finished_at",  header: "Finished", size: 170 },
    {
      accessorKey: "error_message",
      header: "Error",
      size: 200,
      Cell: ({ cell }) => {
        const v = cell.getValue<string | null>();
        return v ? (
          <Typography variant="caption" color="error" title={v}>
            {v.length > 60 ? v.slice(0, 60) + "…" : v}
          </Typography>
        ) : null;
      },
    },
  ], []);

  const table = useMaterialReactTable({
    columns,
    data: rows,
    getRowId: (row) => String(row.job_id),
    state: { isLoading: loading },
    initialState: { density: "compact", pagination: { pageSize: 25, pageIndex: 0 } },
    enableColumnResizing: true,
    enableStickyHeader: true,
    muiTableContainerProps: { sx: { maxHeight: "calc(100vh - 220px)" } },
  });

  if (!token) return <div>Authenticating…</div>;

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Sync Job History</Typography>
      <MaterialReactTable table={table} />
    </Box>
  );
}
