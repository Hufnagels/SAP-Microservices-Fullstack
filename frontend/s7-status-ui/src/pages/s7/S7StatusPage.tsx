import { useEffect, useRef, useState, useCallback } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import LinearProgress from '@mui/material/LinearProgress';
import Tooltip from '@mui/material/Tooltip';
import { toast } from 'react-toastify';
import { opcuaApi } from '../../api/opcuaApi';

// ── Types ──────────────────────────────────────────────────────────────────

interface OpcuaStatus {
  connected: boolean;
  endpoint_url: string;
  security_mode: string;
  poll_interval_ms: number;
  server_state: string | null;
  namespace_count: number;
  consecutive_errors: number;
  last_successful_read: number | null;
  total_reads: number;
  total_writes: number;
  subscription_active: boolean;
  uptime_seconds: number;
}

interface ProcessData {
  timestamp: number;
  read_time_ms: number;
  data: Record<string, number | boolean | string | null>;
}

interface Statistics {
  total_reads: number;
  total_writes: number;
  successful_reads: number;
  failed_reads: number;
  avg_read_time_ms: number;
  min_read_time_ms: number;
  max_read_time_ms: number;
  uptime_seconds: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtUptime(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = Math.floor(sec % 60);
  return h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtValue(v: number | boolean | string | null): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(3);
  return String(v);
}

function valueColor(v: number | boolean | string | null, theme: 'alarm' | 'running' | 'default'): 'error' | 'success' | 'default' {
  if (theme === 'alarm') return v ? 'error' : 'success';
  if (theme === 'running') return v ? 'success' : 'error';
  return 'default';
}

// ── Status Card ────────────────────────────────────────────────────────────

function ConnectionCard({ status }: { status: OpcuaStatus | null }) {
  const connected = status?.connected ?? false;
  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Typography variant="h6" fontWeight={700}>Connection</Typography>
          <Chip
            label={connected ? 'CONNECTED' : 'OFFLINE'}
            color={connected ? 'success' : 'error'}
            size="small"
          />
        </Box>
        {status ? (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
            {[
              ['Endpoint',      status.endpoint_url],
              ['Security',      status.security_mode],
              ['Poll interval', `${status.poll_interval_ms} ms`],
              ['Server state',  status.server_state ?? '—'],
              ['Namespaces',    String(status.namespace_count)],
              ['Uptime',        fmtUptime(status.uptime_seconds)],
              ['Total reads',   String(status.total_reads)],
              ['Errors (cons)', String(status.consecutive_errors)],
            ].map(([label, val]) => (
              <Box key={label}>
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography variant="body2" fontWeight={500} noWrap>{val}</Typography>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography color="text.secondary">Loading…</Typography>
        )}
      </CardContent>
    </Card>
  );
}

// ── Node List Card ──────────────────────────────────────────────────────

const ALARM_KEYS   = ['alarm'];
const RUNNING_KEYS = ['running'];

function ProcessDataCard({ data }: { data: ProcessData | null }) {
  if (!data) return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={700} gutterBottom>Node List</Typography>
        <Typography color="text.secondary">Waiting for data…</Typography>
      </CardContent>
    </Card>
  );

  const ts = new Date(data.timestamp * 1000).toLocaleTimeString();

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="h6" fontWeight={700}>Node List</Typography>
          <Box sx={{ textAlign: 'right' }}>
            <Typography variant="caption" color="text.secondary">{ts}</Typography>
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              ({data.read_time_ms.toFixed(1)} ms)
            </Typography>
          </Box>
        </Box>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>Variable</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Value</TableCell>
              <TableCell sx={{ fontWeight: 700 }} align="right">Status</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {Object.entries(data.data).map(([key, val]) => {
              const isAlarm   = ALARM_KEYS.some(k => key.toLowerCase().includes(k));
              const isRunning = RUNNING_KEYS.some(k => key.toLowerCase().includes(k));
              const chipColor = isAlarm
                ? valueColor(val, 'alarm')
                : isRunning
                ? valueColor(val, 'running')
                : 'default';
              return (
                <TableRow key={key} hover>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">{key}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight={600}>{fmtValue(val)}</Typography>
                  </TableCell>
                  <TableCell align="right">
                    {val === null ? (
                      <Chip label="N/A" size="small" color="default" />
                    ) : chipColor !== 'default' ? (
                      <Chip
                        label={val ? (isAlarm ? 'ALARM' : 'RUNNING') : (isAlarm ? 'OK' : 'STOPPED')}
                        size="small"
                        color={chipColor}
                      />
                    ) : null}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Statistics Card ────────────────────────────────────────────────────────

function StatisticsCard({ stats }: { stats: Statistics | null }) {
  if (!stats) return null;
  const successRate = stats.total_reads > 0
    ? (stats.successful_reads / stats.total_reads) * 100
    : 0;

  return (
    <Card>
      <CardContent>
        <Typography variant="h6" fontWeight={700} gutterBottom>Statistics</Typography>
        <Box sx={{ mb: 1.5 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary">Success rate</Typography>
            <Typography variant="body2" fontWeight={600}>{successRate.toFixed(1)}%</Typography>
          </Box>
          <Tooltip title={`${stats.successful_reads} / ${stats.total_reads} reads`}>
            <LinearProgress
              variant="determinate"
              value={successRate}
              color={successRate > 95 ? 'success' : successRate > 80 ? 'warning' : 'error'}
              sx={{ height: 6, borderRadius: 3 }}
            />
          </Tooltip>
        </Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
          {[
            ['Total reads',  String(stats.total_reads)],
            ['Failed reads', String(stats.failed_reads)],
            ['Avg read',     `${stats.avg_read_time_ms.toFixed(1)} ms`],
            ['Min / Max',    `${stats.min_read_time_ms.toFixed(1)} / ${stats.max_read_time_ms.toFixed(1)} ms`],
            ['Writes',       String(stats.total_writes)],
            ['Uptime',       fmtUptime(stats.uptime_seconds)],
          ].map(([label, val]) => (
            <Box key={label}>
              <Typography variant="caption" color="text.secondary">{label}</Typography>
              <Typography variant="body2" fontWeight={500}>{val}</Typography>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────

const REFRESH_MS = 1500;

export default function S7StatusPage() {
  const [opcStatus,  setOpcStatus]  = useState<OpcuaStatus | null>(null);
  const [processData, setProcessData] = useState<ProcessData | null>(null);
  const [statistics,  setStatistics]  = useState<Statistics | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchAll = useCallback(async () => {
    try {
      const [statusRes, dataRes, statsRes] = await Promise.allSettled([
        opcuaApi.get<OpcuaStatus>('/status'),
        opcuaApi.get<ProcessData>('/process-data'),
        opcuaApi.get<Statistics>('/statistics'),
      ]);
      if (statusRes.status === 'fulfilled') setOpcStatus(statusRes.value.data);
      if (dataRes.status   === 'fulfilled') setProcessData(dataRes.value.data);
      if (statsRes.status  === 'fulfilled') setStatistics(statsRes.value.data);
    } catch {
      toast.error('Failed to fetch OPC-UA data');
    }
  }, []);

  useEffect(() => {
    fetchAll();
    intervalRef.current = setInterval(fetchAll, REFRESH_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchAll]);

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        S7-1500 OPC-UA Status
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Live data — refreshes every {REFRESH_MS / 1000}s
      </Typography>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <ConnectionCard status={opcStatus} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <StatisticsCard stats={statistics} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <ProcessDataCard data={processData} />
        </Grid>
      </Grid>
    </Box>
  );
}
