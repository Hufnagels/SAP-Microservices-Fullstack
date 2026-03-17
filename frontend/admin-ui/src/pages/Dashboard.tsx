// src/pages/Dashboard.tsx
// Real-time platform overview: service health, KPI stats, recent sync jobs.

import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import {
  Box, Grid, Paper, Typography, Chip, CircularProgress,
  Table, TableBody, TableCell, TableHead, TableRow, IconButton, Tooltip,
  Divider, Stack, Dialog, DialogTitle, DialogContent, DialogActions, Button,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import FolderIcon from '@mui/icons-material/Folder';
import SyncIcon from '@mui/icons-material/Sync';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { toast } from 'react-toastify';

import type { RootState } from '../app/store';

interface ServiceRow {
  id: number;
  name: string;
  pascal_name: string | null;
  api_endpoint: string | null;
  is_active: boolean;
}

interface Job {
  job_id: number;
  source_query: string | null;
  target_table: string | null;
  status: string | null;
  started_at: string | null;
  rows_written: number | null;
  username: string | null;
  sync_type: string | null;
}

interface QueryRow {
  QueryName?: string;
  query_name?: string;
  Description?: string;
  description?: string;
  Service?: string;
  service?: string;
  TargetTable?: string;
  target_table?: string;
  [key: string]: unknown;
}

type HealthStatus = 'up' | 'down' | 'checking';

const STATUS_COLOR: Record<HealthStatus, 'success' | 'error' | 'default'> = {
  up: 'success', down: 'error', checking: 'default',
};

const JOB_STATUS_COLOR: Record<string, 'success' | 'error' | 'warning' | 'default'> = {
  SUCCESS: 'success', FAILED: 'error', RUNNING: 'warning',
};

const CHECK_INTERVAL = Number(import.meta.env.VITE_APP_SERVICE_CHECK_INTERVAL ?? 30_000);

export default function Dashboard() {
  const token    = useSelector((s: RootState) => s.auth.token);
  const navigate = useNavigate();

  const [services,      setServices]      = useState<ServiceRow[]>([]);
  const [healthMap,     setHealthMap]     = useState<Record<string, HealthStatus>>({});
  const [recentJobs,    setRecentJobs]    = useState<Job[]>([]);
  const [stats,         setStats]         = useState({ users: 0, files: 0, jobs: 0, queries: 0 });
  const [loading,       setLoading]       = useState(true);
  const [lastRefresh,   setLastRefresh]   = useState<Date>(new Date());

  // Queries modal
  const [queriesOpen,   setQueriesOpen]   = useState(false);
  const [queries,       setQueries]       = useState<QueryRow[]>([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [syncingQuery,  setSyncingQuery]  = useState<string | null>(null);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const checkHealth = useCallback(async (svcs: ServiceRow[]) => {
    const initial: Record<string, HealthStatus> = {};
    svcs.forEach((s) => { initial[s.name] = 'checking'; });
    setHealthMap(initial);

    await Promise.all(
      svcs.map(async (svc) => {
        if (!svc.api_endpoint) {
          setHealthMap((prev) => ({ ...prev, [svc.name]: 'down' }));
          return;
        }
        try {
          await axios.get(`${svc.api_endpoint}/health`, { headers, timeout: 5000 });
          setHealthMap((prev) => ({ ...prev, [svc.name]: 'up' }));
        } catch {
          setHealthMap((prev) => ({ ...prev, [svc.name]: 'down' }));
        }
      }),
    );
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Services list
      const svcRes = await axios.get<ServiceRow[]>('/auth/services?active_only=true', { headers });
      const svcs = svcRes.data;
      setServices(svcs);
      checkHealth(svcs);

      // Stats + recent jobs in parallel
      const [usersRes, filesRes, jobsRes, queriesRes] = await Promise.allSettled([
        axios.get<unknown[]>('/auth/users', { headers }),
        axios.get<unknown[]>('/files/', { headers }),
        axios.get<Job[]>('/sap/jobs?limit=8', { headers }),
        axios.get<unknown[]>('/sap/queries', { headers }),
      ]);

      setStats({
        users:   usersRes.status   === 'fulfilled' ? usersRes.value.data.length   : 0,
        files:   filesRes.status   === 'fulfilled' ? filesRes.value.data.length   : 0,
        jobs:    jobsRes.status    === 'fulfilled' ? jobsRes.value.data.length    : 0,
        queries: queriesRes.status === 'fulfilled' ? queriesRes.value.data.length : 0,
      });

      if (jobsRes.status === 'fulfilled') setRecentJobs(jobsRes.value.data);
    } finally {
      setLoading(false);
      setLastRefresh(new Date());
    }
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  // ── Open queries modal ─────────────────────────────────────────────────────
  const openQueriesModal = async () => {
    setQueriesOpen(true);
    if (queries.length > 0) return; // already loaded
    setQueriesLoading(true);
    try {
      const res = await axios.get<QueryRow[]>('/sap/queries', { headers });
      setQueries(res.data);
    } catch {
      setQueries([]);
    } finally {
      setQueriesLoading(false);
    }
  };

  // ── Run sync from Queries modal ────────────────────────────────────────────
  const runSync = async (q: QueryRow) => {
    const queryName = String(q.query_name ?? q.QueryName ?? '');
    const baseTable = String(q.base_table ?? q.TargetTable ?? '');
    setSyncingQuery(queryName);
    try {
      // 1. Fire async job — returns job_id immediately (202 Accepted)
      const startRes = await axios.post<{ job_id: number; status: string; table: string }>(
        '/sap/sync-query',
        { query_name: queryName, base_table: baseTable },
        { headers },
      );
      const jobId = startRes.data.job_id;

      // 2. Poll until status != RUNNING (max 120s, 2s intervals)
      let job: Job | null = null;
      for (let i = 0; i < 60; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const pollRes = await axios.get<Job>(`/sap/jobs/${jobId}`, { headers });
        job = pollRes.data;
        if (job.status !== 'RUNNING') break;
      }

      // 3. Show result
      if (job?.status === 'SUCCESS') {
        toast.success(`Synced ${job.rows_written ?? 0} rows → ${baseTable} (job #${jobId})`);
      } else {
        toast.error(`Sync job #${jobId} ended with status: ${job?.status ?? 'unknown'}`);
      }

      // 4. Refresh recent jobs + job count
      const jobsRes = await axios.get<Job[]>('/sap/jobs?limit=8', { headers });
      setRecentJobs(jobsRes.data);
      setStats((prev) => ({ ...prev, jobs: jobsRes.data.length }));
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : 'Sync failed';
      toast.error(String(msg ?? 'Sync failed'));
    } finally {
      setSyncingQuery(null);
    }
  };

  // ── KPI card hover style ───────────────────────────────────────────────────
  const clickableSx = {
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    '&:hover': { transform: 'translateY(-2px)', boxShadow: 4 },
  };

  const statCards = [
    {
      label: 'Users',
      value: stats.users,
      icon: <PeopleIcon />,
      color: 'primary.main',
      onClick: () => navigate('/users/list'),
    },
    {
      label: 'Files',
      value: stats.files,
      icon: <FolderIcon />,
      color: 'warning.main',
      onClick: () => navigate('/files/files2'),
    },
    {
      label: 'Queries',
      value: stats.queries,
      icon: <QueryStatsIcon />,
      color: 'info.main',
      onClick: openQueriesModal,
    },
    {
      label: 'Jobs (recent)',
      value: stats.jobs,
      icon: <SyncIcon />,
      color: 'success.main',
      onClick: () => document.getElementById('recent-sync-jobs')?.scrollIntoView({ behavior: 'smooth' }),
    },
  ];

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>Dashboard</Typography>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" color="text.secondary">
            {loading ? 'Refreshing…' : `Updated ${lastRefresh.toLocaleTimeString()}`}
          </Typography>
          <Tooltip title="Refresh now">
            <IconButton size="small" onClick={loadData} disabled={loading}>
              {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {/* ── KPI stat cards ─────────────────────────────────────────── */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {statCards.map((s) => (
          <Grid key={s.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Box onClick={s.onClick} sx={clickableSx}>
              <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box sx={{ color: s.color, display: 'flex' }}>{s.icon}</Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">{s.label}</Typography>
                  <Typography variant="h5" fontWeight={700}>{s.value}</Typography>
                </Box>
              </Paper>
            </Box>
          </Grid>
        ))}
      </Grid>

      {/* ── Service health ─────────────────────────────────────────── */}
      <Paper sx={{ p: 2.5, mb: 3 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>Service Health</Typography>
        <Grid container spacing={1.5}>
          {services.map((svc) => {
            const status: HealthStatus = healthMap[svc.name] ?? 'checking';
            return (
              <Grid key={svc.name} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Box
                  onClick={() => navigate(`/services/manage?name=${svc.name}`)}
                  sx={clickableSx}
                >
                  <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" fontWeight={600}>
                        {svc.pascal_name ?? svc.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {svc.api_endpoint ?? '—'}
                      </Typography>
                    </Box>
                    <Chip
                      label={status === 'checking' ? '…' : status.toUpperCase()}
                      color={STATUS_COLOR[status]}
                      size="small"
                      sx={{ minWidth: 52 }}
                    />
                  </Paper>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </Paper>

      {/* ── Recent Sync Jobs ───────────────────────────────────────── */}
      <Paper id="recent-sync-jobs" sx={{ p: 2.5 }}>
        <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>Recent Sync Jobs</Typography>
        {recentJobs.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No jobs found.</Typography>
        ) : (
          <>
            <Divider sx={{ mb: 1 }} />
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>ID</TableCell>
                  <TableCell>Query</TableCell>
                  <TableCell>Target</TableCell>
                  <TableCell>Type</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Rows</TableCell>
                  <TableCell>Started</TableCell>
                  <TableCell>User</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {recentJobs.map((job) => (
                  <TableRow key={job.job_id} hover>
                    <TableCell>{job.job_id}</TableCell>
                    <TableCell>{job.source_query ?? '—'}</TableCell>
                    <TableCell>{job.target_table ?? '—'}</TableCell>
                    <TableCell>
                      <Chip label={job.sync_type ?? '—'} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={job.status ?? '?'}
                        color={JOB_STATUS_COLOR[job.status ?? ''] ?? 'default'}
                        size="small"
                      />
                    </TableCell>
                    <TableCell>{job.rows_written ?? '—'}</TableCell>
                    <TableCell>
                      {job.started_at
                        ? new Date(job.started_at).toLocaleString()
                        : '—'}
                    </TableCell>
                    <TableCell>{job.username ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </Paper>

      {/* ── Queries modal ──────────────────────────────────────────── */}
      <Dialog open={queriesOpen} onClose={() => setQueriesOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>SAP Queries ({queries.length})</DialogTitle>
        <DialogContent dividers>
          {queriesLoading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : queries.length === 0 ? (
            <Typography color="text.secondary">No queries found.</Typography>
          ) : (
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Query Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Service</TableCell>
                  <TableCell>Target Table</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {queries.map((q, i) => {
                  const queryName = String(q.query_name ?? q.QueryName ?? '');
                  const baseTable = String(q.base_table ?? q.TargetTable ?? '');
                  const isSyncing = syncingQuery === queryName;
                  return (
                    <TableRow key={i} hover>
                      <TableCell>{queryName || '—'}</TableCell>
                      <TableCell>{String(q.description ?? q.Description ?? '—')}</TableCell>
                      <TableCell>{String(q.service_name ?? q.Service ?? '—')}</TableCell>
                      <TableCell>{baseTable || '—'}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {baseTable ? (
                          <Tooltip title={`Run sync → ${baseTable}`}>
                            <span>
                              <Button
                                size="small"
                                variant="outlined"
                                color="success"
                                startIcon={isSyncing
                                  ? <CircularProgress size={14} color="inherit" />
                                  : <PlayArrowIcon fontSize="small" />}
                                onClick={() => runSync(q)}
                                disabled={syncingQuery !== null}
                              >
                                {isSyncing ? 'Running…' : 'Run sync'}
                              </Button>
                            </span>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setQueriesOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
