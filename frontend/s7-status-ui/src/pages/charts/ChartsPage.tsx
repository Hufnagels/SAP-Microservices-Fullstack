import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Chip from '@mui/material/Chip';
import RefreshIcon from '@mui/icons-material/Refresh';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
} from 'recharts';
import { getNodes, getTimeseries } from '../../api/opcuaApi';
import type { TimeseriesPoint, NodeNames } from '../../api/opcuaApi';

// ── Time range options ────────────────────────────────────────────────────────

const RANGES: { label: string; minutes: number }[] = [
  { label: '10 min', minutes: 10 },
  { label: '1 h',   minutes: 60 },
  { label: '8 h',   minutes: 480 },
  { label: '24 h',  minutes: 1440 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTime(ts: number): string {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatTooltipLabel(ts: number): string {
  return new Date(ts * 1000).toLocaleString();
}

// ── Alarms table ──────────────────────────────────────────────────────────────

interface AlarmPoint extends TimeseriesPoint {
  active: boolean;
}

function AlarmTimeline({ points, node }: { points: TimeseriesPoint[]; node: string }) {
  if (points.length === 0) return null;

  const last = points[points.length - 1] as AlarmPoint;
  const isActive = last.value === 1;

  const transitions = points.reduce<{ ts: number; active: boolean }[]>((acc, p, i) => {
    const active = p.value === 1;
    if (i === 0 || active !== acc[acc.length - 1].active) {
      acc.push({ ts: p.ts, active });
    }
    return acc;
  }, []);

  return (
    <Box sx={{ mb: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
        <Typography variant="body2" sx={{ minWidth: 140, fontWeight: 600 }}>
          {node}
        </Typography>
        <Chip
          size="small"
          label={isActive ? 'ACTIVE' : 'OK'}
          color={isActive ? 'error' : 'success'}
        />
        <Typography variant="caption" color="text.secondary">
          {transitions.length > 0
            ? `Last change: ${formatTime(transitions[transitions.length - 1].ts)}`
            : ''}
        </Typography>
      </Box>
    </Box>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

const LS_MEASUREMENT = 's7ui.charts.measurement';
const LS_NODE        = 's7ui.charts.node';

export default function ChartsPage() {
  const [nodes, setNodes]           = useState<NodeNames>({ process: [], alarms: [] });
  const [measurement, setMeasurement] = useState<'process_data' | 'alarms'>(
    () => (localStorage.getItem(LS_MEASUREMENT) as 'process_data' | 'alarms') ?? 'process_data'
  );
  const [selectedNode, setSelectedNode] = useState<string>(
    () => localStorage.getItem(LS_NODE) ?? ''
  );
  const [rangeMinutes, setRangeMinutes] = useState<number>(60);
  const [points, setPoints]         = useState<TimeseriesPoint[]>([]);
  const [alarmPoints, setAlarmPoints] = useState<Record<string, TimeseriesPoint[]>>({});
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [lastFetch, setLastFetch]   = useState<Date | null>(null);

  // Persist measurement + node to localStorage on change
  useEffect(() => { localStorage.setItem(LS_MEASUREMENT, measurement); }, [measurement]);
  useEffect(() => { if (selectedNode) localStorage.setItem(LS_NODE, selectedNode); }, [selectedNode]);

  // Load available node names on mount
  useEffect(() => {
    getNodes()
      .then((n) => {
        setNodes(n);
        // Only fall back to first node if nothing was persisted
        const saved = localStorage.getItem(LS_NODE);
        if (!saved) {
          if (n.process.length > 0) setSelectedNode(n.process[0]);
        }
      })
      .catch(() => {/* node names unavailable — will retry on user action */});
  }, []);

  // Auto-update selectedNode when measurement changes — but keep saved node if it's valid
  useEffect(() => {
    const list = measurement === 'process_data' ? nodes.process : nodes.alarms;
    if (list.length === 0) return;
    if (!list.includes(selectedNode)) setSelectedNode(list[0]);
  }, [measurement, nodes]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = useCallback(async () => {
    if (!selectedNode) return;
    setLoading(true);
    setError(null);
    const now = Date.now() / 1000;
    const fromTs = now - rangeMinutes * 60;

    try {
      if (measurement === 'alarms') {
        // Fetch all alarm nodes in parallel
        const alarmNodes = nodes.alarms.length > 0 ? nodes.alarms : [selectedNode];
        const results = await Promise.allSettled(
          alarmNodes.map((n) => getTimeseries('alarms', n, fromTs, now, 2000))
        );
        const map: Record<string, TimeseriesPoint[]> = {};
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') map[alarmNodes[i]] = r.value.points;
        });
        setAlarmPoints(map);
        setPoints([]);
      } else {
        const res = await getTimeseries(measurement, selectedNode, fromTs, now, 2000);
        setPoints(res.points);
        setAlarmPoints({});
      }
      setLastFetch(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load timeseries data');
    } finally {
      setLoading(false);
    }
  }, [selectedNode, measurement, rangeMinutes, nodes.alarms]);

  // Fetch on filter change
  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Auto-refresh every 30 s
  useEffect(() => {
    const id = setInterval(() => { void fetchData(); }, 30_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const nodeOptions = measurement === 'process_data' ? nodes.process : nodes.alarms;

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} gutterBottom>
        Timeseries Charts
      </Typography>

      {/* ── Controls ── */}
      <Paper sx={{ p: 2, mb: 2, display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Measurement</InputLabel>
          <Select
            value={measurement}
            label="Measurement"
            onChange={(e) => setMeasurement(e.target.value as 'process_data' | 'alarms')}
          >
            <MenuItem value="process_data">Process Data</MenuItem>
            <MenuItem value="alarms">Alarms</MenuItem>
          </Select>
        </FormControl>

        {measurement === 'process_data' && (
          <FormControl size="small" sx={{ minWidth: 160 }}>
            <InputLabel>Node</InputLabel>
            <Select
              value={selectedNode}
              label="Node"
              onChange={(e) => setSelectedNode(e.target.value)}
            >
              {nodeOptions.map((n) => (
                <MenuItem key={n} value={n}>{n}</MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <ToggleButtonGroup
          value={rangeMinutes}
          exclusive
          size="small"
          onChange={(_, v) => { if (v !== null) setRangeMinutes(v as number); }}
        >
          {RANGES.map((r) => (
            <ToggleButton key={r.minutes} value={r.minutes}>
              {r.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Tooltip title="Refresh now">
          <span>
            <IconButton onClick={() => void fetchData()} disabled={loading}>
              {loading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </span>
        </Tooltip>

        {lastFetch && (
          <Typography variant="caption" color="text.secondary">
            Updated {lastFetch.toLocaleTimeString()}
          </Typography>
        )}
      </Paper>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      {/* ── Process data chart ── */}
      {measurement === 'process_data' && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            {selectedNode}  —  last {RANGES.find((r) => r.minutes === rangeMinutes)?.label}
            {' '}({points.length} points)
          </Typography>
          {points.length === 0 && !loading ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No data in selected range. Make sure opcua-service is connected and InfluxDB is running.
            </Typography>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={points} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="ts"
                  tickFormatter={formatTime}
                  tick={{ fontSize: 11 }}
                  minTickGap={60}
                />
                <YAxis tick={{ fontSize: 11 }} width={55} />
                <ReTooltip
                  labelFormatter={formatTooltipLabel}
                  formatter={(v: number) => [v.toFixed(4), selectedNode]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={selectedNode}
                  dot={false}
                  strokeWidth={2}
                  stroke="#00bcd4"
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Paper>
      )}

      {/* ── Alarms panel ── */}
      {measurement === 'alarms' && (
        <Paper sx={{ p: 2 }}>
          <Typography variant="subtitle2" gutterBottom>
            Alarm states — last {RANGES.find((r) => r.minutes === rangeMinutes)?.label}
          </Typography>
          {Object.keys(alarmPoints).length === 0 && !loading ? (
            <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
              No alarm data in selected range.
            </Typography>
          ) : (
            <>
              <Box sx={{ mb: 2 }}>
                {Object.entries(alarmPoints).map(([name, pts]) => (
                  <AlarmTimeline key={name} node={name} points={pts} />
                ))}
              </Box>
              {/* Chart for selected alarm node */}
              {alarmPoints[selectedNode] && alarmPoints[selectedNode].length > 0 && (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {selectedNode} — timeline (1 = active, 0 = OK)
                  </Typography>
                  <ResponsiveContainer width="100%" height={140}>
                    <LineChart
                      data={alarmPoints[selectedNode]}
                      margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="ts" tickFormatter={formatTime} tick={{ fontSize: 11 }} minTickGap={60} />
                      <YAxis domain={[0, 1]} ticks={[0, 1]} tick={{ fontSize: 11 }} width={30} />
                      <ReTooltip
                        labelFormatter={formatTooltipLabel}
                        formatter={(v: number) => [v === 1 ? 'ACTIVE' : 'OK', selectedNode]}
                      />
                      <Line
                        type="stepAfter"
                        dataKey="value"
                        name={selectedNode}
                        dot={false}
                        strokeWidth={2}
                        stroke="#ef5350"
                        isAnimationActive={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </>
              )}
            </>
          )}
        </Paper>
      )}
    </Box>
  );
}
