// src/pages/querys/QueryTiming.tsx
// Crontab / scheduled sync placeholder — lists queries with cron schedule field.

import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
} from 'material-react-table';
import {
  Box, Typography, Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack,
} from '@mui/material';
import { toast } from 'react-toastify';

import type { RootState, AppDispatch } from '../../app/store';
import { fetchQueries, type QueryDef } from '../../features/queries/queriesSlice';

const ALLOWED_ROLES = new Set(['superadmin', 'admin', 'worker']);

export default function QueryTiming() {
  const dispatch = useDispatch<AppDispatch>();
  const { items: queries, loading } = useSelector((s: RootState) => s.queries);
  const user = useSelector((s: RootState) => s.auth.user);

  // All hooks must come before any early return (Rules of Hooks)
  const [scheduleTarget, setScheduleTarget] = useState<QueryDef | null>(null);
  const [cronExpr, setCronExpr]             = useState('');

  useEffect(() => {
    dispatch(fetchQueries()).unwrap().catch(() => toast.error('Failed to load queries'));
  }, [dispatch]);

  const handleOpenSchedule = (row: QueryDef) => {
    setScheduleTarget(row);
    setCronExpr('');
  };

  const handleSaveSchedule = () => {
    // TODO: persist cron schedule to backend when scheduling infra is ready
    toast.info(`Schedule "${cronExpr}" saved for "${scheduleTarget?.query_name}" (not yet persisted)`);
    setScheduleTarget(null);
  };

  const columns = useMemo<MRT_ColumnDef<QueryDef>[]>(() => [
    { accessorKey: 'query_id',   header: 'ID',           size: 70 },
    { accessorKey: 'query_name', header: 'Query',         size: 220 },
    { accessorKey: 'base_table', header: 'Target Table',  size: 180 },
    {
      id: 'schedule',
      header: 'Schedule',
      size: 160,
      Cell: () => (
        <Typography variant="caption" color="text.secondary">
          —
        </Typography>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 120,
      Cell: ({ row }) => (
        <Button size="small" variant="outlined" onClick={() => handleOpenSchedule(row.original)}>
          Set schedule
        </Button>
      ),
    },
  ], []);

  const table = useMaterialReactTable({
    columns,
    data: queries,
    getRowId: (row) => String(row.query_id),
    state: { isLoading: loading },
    initialState: { density: 'compact', pagination: { pageSize: 20, pageIndex: 0 } },
    enableColumnResizing: true,
    enableStickyHeader: true,
    muiTableContainerProps: { sx: { maxHeight: 'calc(100vh - 220px)' } },
  });

  if (!user || !ALLOWED_ROLES.has(user.role)) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h6" sx={{ mb: 1 }}>Crontab — Scheduled Syncs</Typography>
        <Typography color="error">Access denied. Only superadmin, admin, and worker roles can manage scheduled syncs.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Crontab — Scheduled Syncs</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Set a cron expression for each query to run on a schedule.
        Scheduling backend is not yet active — schedules will be persisted once the cron infrastructure is ready.
      </Typography>

      <MaterialReactTable table={table} />

      <Dialog open={Boolean(scheduleTarget)} onClose={() => setScheduleTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Set schedule — {scheduleTarget?.query_name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Cron expression"
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder="0 6 * * 1-5"
              helperText="Standard 5-field cron: min hour dom month dow"
              fullWidth
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setScheduleTarget(null)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSchedule} disabled={!cronExpr.trim()}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
