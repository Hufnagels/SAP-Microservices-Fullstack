// src/pages/services/ServiceManage.tsx
import { useEffect, useState, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  Box, Typography, Paper, Chip, Button, Stack, Grid,
  CircularProgress, Divider, IconButton, Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { toast } from 'react-toastify';
import type { RootState } from '../../app/store';

interface Service {
  id: number;
  name: string;
  pascal_name: string | null;
  description: string | null;
  service_url: string | null;
  port: number | null;
  make_command: string | null;
  api_endpoint: string | null;
  is_active: boolean;
}

type HealthStatus = 'up' | 'down' | 'checking';

const STATUS_COLOR: Record<HealthStatus, 'success' | 'error' | 'default'> = {
  up: 'success', down: 'error', checking: 'default',
};

const CHECK_INTERVAL = Number(import.meta.env.VITE_APP_SERVICE_CHECK_INTERVAL ?? 30_000);

export default function ServiceManage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const svcName = searchParams.get('name') ?? '';
  const token   = useSelector((s: RootState) => s.auth.token);

  const [service,     setService]     = useState<Service | null>(null);
  const [loading,     setLoading]     = useState(true);
  const [health,      setHealth]      = useState<HealthStatus>('checking');
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [acting,      setActing]      = useState<string | null>(null); // 'start'|'stop'|'restart'
  const [logLines,    setLogLines]    = useState<string[]>([]);

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // ── Fetch service ──────────────────────────────────────────────────────────
  const fetchService = useCallback(async () => {
    if (!token || !svcName) return;
    setLoading(true);
    try {
      const res = await axios.get<Service[]>('/auth/services', { headers });
      const found = res.data.find((s) => s.name === svcName) ?? null;
      setService(found);
      if (!found) toast.error(`Service "${svcName}" not found`);
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : 'Failed to load service';
      toast.error(String(msg ?? 'Failed to load service'));
    } finally {
      setLoading(false);
    }
  }, [token, svcName]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Health check ───────────────────────────────────────────────────────────
  const checkHealth = useCallback(async (svc: Service) => {
    if (!svc.api_endpoint) {
      setHealth('down');
      setLastChecked(new Date());
      return;
    }
    setHealth('checking');
    try {
      await axios.get(`${svc.api_endpoint}/health`, { timeout: 5000 });
      setHealth('up');
    } catch {
      setHealth('down');
    }
    setLastChecked(new Date());
  }, []);

  useEffect(() => { fetchService(); }, [fetchService]);

  useEffect(() => {
    if (!service) return;
    checkHealth(service);
    const interval = setInterval(() => checkHealth(service), CHECK_INTERVAL);
    return () => clearInterval(interval);
  }, [service, checkHealth]);

  // ── Service action ─────────────────────────────────────────────────────────
  const appendLog = (lines: string) => {
    const ts = new Date().toLocaleTimeString();
    setLogLines((prev) => [...prev, `[${ts}] ${lines}`]);
  };

  const handleAction = async (action: 'start' | 'stop' | 'restart') => {
    if (!service) return;
    setActing(action);
    appendLog(`▶ docker ${action} microservices-${service.name}-1`);
    try {
      const res = await axios.post<{
        returncode: number; stdout: string; stderr: string; container: string;
      }>(`/auth/services/${service.id}/action`, { action }, { headers });
      const { returncode, stdout, stderr, container } = res.data;
      if (stdout) appendLog(stdout);
      if (stderr) appendLog(stderr);
      appendLog(`✓ Exit code: ${returncode} — ${container}`);
      if (returncode === 0) {
        toast.success(`${action} succeeded`);
        setTimeout(() => checkHealth(service), 2000); // re-check health after action
      } else {
        toast.warn(`${action} exited with code ${returncode}`);
      }
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : 'Action failed';
      appendLog(`✗ Error: ${String(msg ?? 'Action failed')}`);
      toast.error(String(msg ?? 'Action failed'));
    } finally {
      setActing(null);
    }
  };

  // ── Copy to clipboard ──────────────────────────────────────────────────────
  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast.success('Copied to clipboard'),
      () => toast.error('Failed to copy'),
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight={200}>
        <CircularProgress />
      </Box>
    );
  }

  if (!service) {
    return (
      <Box>
        <Typography variant="h5" fontWeight={700} sx={{ mb: 2 }}>Manage Service</Typography>
        <Typography color="text.secondary">
          {svcName ? `Service "${svcName}" not found.` : 'No service name provided in URL.'}
        </Typography>
      </Box>
    );
  }

  const fieldRows: { label: string; value: string | number | null }[] = [
    { label: 'Name',         value: service.name },
    { label: 'Pascal Name',  value: service.pascal_name },
    { label: 'Description',  value: service.description },
    { label: 'Service URL',  value: service.service_url },
    { label: 'Port',         value: service.port },
    { label: 'API Endpoint', value: service.api_endpoint },
    { label: 'Make Command', value: service.make_command },
  ];

  return (
    <Box>

      <Grid
        container
        direction="row-reverse"
        sx={{
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/services/list')}
          size="small"
          variant="outlined"
        >
          Back
        </Button>
        <Typography variant="h5" fontWeight={700}>
          Manage Service
        </Typography>
      </Grid>

      <Grid container spacing={3}>
        {/* ── Service detail card ─────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight={600}>
                {service.pascal_name ?? service.name}
              </Typography>
              {/* <Chip
                label={service.is_active ? 'Active' : 'Inactive'}
                color={service.is_active ? 'success' : 'default'}
                size="small"
              /> */}
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              {fieldRows.map((row) => (
                <Box key={row.label} sx={{ display: 'flex', gap: 1 }}>
                  <Typography variant="body2" color="text.secondary" sx={{ minWidth: 120 }}>
                    {row.label}
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {row.value != null ? String(row.value) : '—'}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </Paper>
        </Grid>

        {/* ── Health + Actions ────────────────────────────────────────────── */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Stack spacing={2}>
            {/* Health */}
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
                Health Status
              </Typography>
              <Stack direction="row" alignItems="center" spacing={2}>
                {health === 'checking' ? (
                  <CircularProgress size={20} />
                ) : (
                  <Chip
                    label={health.toUpperCase()}
                    color={STATUS_COLOR[health]}
                    size="small"
                    sx={{ minWidth: 60 }}
                  />
                )}
                <Typography variant="caption" color="text.secondary">
                  {lastChecked
                    ? `Last checked: ${lastChecked.toLocaleTimeString()}`
                    : 'Checking…'}
                </Typography>
              </Stack>
              {service.api_endpoint && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  {service.api_endpoint}/health
                </Typography>
              )}
            </Paper>

            {/* Actions */}
            <Paper sx={{ p: 2.5 }}>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 1.5 }}>
                Actions
              </Typography>
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={acting === 'start' ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                  onClick={() => handleAction('start')}
                  disabled={acting !== null}
                >
                  Start
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={acting === 'stop' ? <CircularProgress size={16} color="inherit" /> : <StopIcon />}
                  onClick={() => handleAction('stop')}
                  disabled={acting !== null}
                >
                  Stop
                </Button>
                <Button
                  variant="outlined"
                  startIcon={acting === 'restart' ? <CircularProgress size={16} color="inherit" /> : <RestartAltIcon />}
                  onClick={() => handleAction('restart')}
                  disabled={acting !== null}
                >
                  Restart
                </Button>
              </Stack>
            </Paper>
          </Stack>
        </Grid>

        {/* ── Make command ────────────────────────────────────────────────── */}
        {service.make_command && (
          <Grid size={{ xs: 12 }}>
            <Paper sx={{ p: 2.5 }}>
              <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                <Typography variant="h6" fontWeight={600}>Make Command</Typography>
                <Tooltip title="Copy command">
                  <IconButton size="small" onClick={() => handleCopy(service.make_command!)}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
              <Box
                component="pre"
                sx={{
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  bgcolor: 'action.hover',
                  borderRadius: 1,
                  p: 1.5,
                  m: 0,
                  overflowX: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                }}
              >
                {service.make_command}
              </Box>
            </Paper>
          </Grid>
        )}

        {/* ── Action log panel ─────────────────────────────────────────────── */}
        <Grid size={{ xs: 12 }}>
          <Paper sx={{ p: 2.5 }}>
            <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
              <Typography variant="h6" fontWeight={600}>Terminal Output</Typography>
              {logLines.length > 0 && (
                <Tooltip title="Clear log">
                  <IconButton size="small" onClick={() => setLogLines([])}>
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Stack>
            <Box
              component="pre"
              sx={{
                fontFamily: 'monospace',
                fontSize: '0.8rem',
                bgcolor: 'grey.900',
                color: 'grey.100',
                borderRadius: 1,
                p: 1.5,
                m: 0,
                minHeight: 80,
                maxHeight: 320,
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
              }}
            >
              {logLines.length === 0
                ? '# Use Start / Stop / Restart to see output here'
                : logLines.join('\n')}
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
