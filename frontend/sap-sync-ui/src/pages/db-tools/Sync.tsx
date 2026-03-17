// src/pages/db-tools/Sync.tsx

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Typography, TextField, Button, Stack, FormControl,
  InputLabel, Select, MenuItem, CircularProgress, Autocomplete,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import SyncIcon from '@mui/icons-material/Sync';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

import axios from 'axios';
import { sapApi } from '../../api/client';
import type { RootState, AppDispatch } from '../../app/store';
import { fetchQueries } from '../../features/queries/queriesSlice';
import type { User } from '../../features/auth/authSlice';
import { VITE_APP_API_URL } from '../../features/config';

// Returns true if the user has at least read access to svcName.
// Queries with no service_name are always visible.
function canAccessService(
  user: User,
  svcName: string | null,
  permissions: Record<string, Record<string, string[]>>,
): boolean {
  if (!svcName) return true;
  const effRole = (user.service_roles ?? {})[svcName] ?? user.role;
  if (effRole === 'forbidden') return false;
  const svcPerms = (permissions[effRole] ?? {})[svcName] ?? [];
  return svcPerms.length > 0;
}

async function downloadExcel(sqlCode: string, logToJobs: boolean) {
  const res = await sapApi.post<Record<string, unknown>[]>('/queries/preview', {
    sql_code: sqlCode,
    log_to_jobs: logToJobs,
  });
  const rows = res.data;
  if (!rows.length) { toast.warn('No rows returned'); return 0; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sqlCode.slice(0, 31));
  XLSX.writeFile(wb, `${sqlCode}.xlsx`);
  return rows.length;
}

export default function Sync() {
  const dispatch   = useDispatch<AppDispatch>();
  const allQueries = useSelector((s: RootState) => s.queries.items);
  const user       = useSelector((s: RootState) => s.auth.user);
  const token      = useSelector((s: RootState) => s.auth.token);

  const [permissions, setPermissions] = useState<Record<string, Record<string, string[]>>>({});

  useEffect(() => {
    if (!token) return;
    axios
      .get(`${VITE_APP_API_URL}/auth/permissions`, { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => setPermissions(r.data as Record<string, Record<string, string[]>>))
      .catch(() => {/* non-critical */});
  }, [token]);

  const queries = user
    ? allQueries.filter((q) => canAccessService(user, q.service_name, permissions))
    : [];

  const [sqlCode,  setSqlCode]  = useState('');
  const [dstTable, setDstTable] = useState('');
  const [loadMode, setLoadMode] = useState<'replace' | 'append'>('replace');
  const [busy,     setBusy]     = useState(false);

  const noTarget = !dstTable.trim();

  useEffect(() => {
    dispatch(fetchQueries());
  }, [dispatch]);

  // When a saved query is selected, auto-fill fields
  const handleQuerySelect = (_: unknown, selected: typeof queries[0] | null) => {
    if (!selected) return;
    setSqlCode(selected.query_name);
    setDstTable(selected.base_table ?? '');
  };

  const handleRun = async () => {
    setBusy(true);
    try {
      if (noTarget) {
        const count = await downloadExcel(sqlCode, true);
        if (count) toast.success(`Downloaded ${count} rows as ${sqlCode}.xlsx (logged as EXCEL)`);
      } else {
        const res = await sapApi.post('/sync', {
          sql_code: sqlCode,
          dst_table: dstTable,
          load_mode: loadMode,
        });
        toast.success(`Synced ${res.data.rows_written ?? 0} rows → ${dstTable}`);
      }
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? (noTarget ? 'Export failed' : 'Sync failed'));
    } finally {
      setBusy(false);
    }
  };

  const handleExcel = async () => {
    setBusy(true);
    try {
      const count = await downloadExcel(sqlCode, false);
      if (count) toast.success(`Downloaded ${count} rows as ${sqlCode}.xlsx`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      toast.error(msg ?? 'Export failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 560 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Sync — SAP B1 → MSSQL</Typography>

      <Stack spacing={2}>
        {queries.length > 0 && (
          <Autocomplete
            options={queries}
            getOptionLabel={(q) => `${q.query_name}${q.description ? ' — ' + q.description : ''}`}
            onChange={handleQuerySelect}
            renderInput={(params) => (
              <TextField {...params} label="Select saved query (optional)" size="small" />
            )}
          />
        )}

        <TextField
          label="SQL Code (SAP B1 SQLQuery code)"
          value={sqlCode}
          onChange={(e) => setSqlCode(e.target.value)}
          fullWidth
        />
        <TextField
          label="Target table"
          value={dstTable}
          onChange={(e) => setDstTable(e.target.value)}
          fullWidth
          placeholder="EXCEL"
          helperText={noTarget ? 'Empty = Excel export only (logged as EXCEL in job history)' : undefined}
        />
        {!noTarget && (
          <FormControl fullWidth>
            <InputLabel>Load mode</InputLabel>
            <Select
              label="Load mode"
              value={loadMode}
              onChange={(e) => setLoadMode(e.target.value as 'replace' | 'append')}
            >
              <MenuItem value="replace">Replace (truncate + insert)</MenuItem>
              <MenuItem value="append">Append</MenuItem>
            </Select>
          </FormControl>
        )}

        <Stack direction="row" spacing={1}>
          <Button
            variant="contained"
            startIcon={busy ? <CircularProgress size={16} color="inherit" /> : noTarget ? <DownloadIcon /> : <SyncIcon />}
            onClick={handleRun}
            disabled={busy || !sqlCode.trim()}
          >
            {noTarget ? 'Download Excel' : 'Run sync'}
          </Button>
          {!noTarget && (
            <Button
              variant="outlined"
              startIcon={busy ? <CircularProgress size={16} /> : <DownloadIcon />}
              onClick={handleExcel}
              disabled={busy || !sqlCode.trim()}
            >
              Download Excel
            </Button>
          )}
        </Stack>
      </Stack>
    </Box>
  );
}
