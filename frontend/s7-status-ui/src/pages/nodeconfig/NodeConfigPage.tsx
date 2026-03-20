import { useEffect, useState, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableBody from '@mui/material/TableBody';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import Chip from '@mui/material/Chip';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';
import CircularProgress from '@mui/material/CircularProgress';
import Alert from '@mui/material/Alert';
import Autocomplete from '@mui/material/Autocomplete';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { toast } from 'react-toastify';
import {
  getNodeConfig, createNodeConfig, updateNodeConfig, deleteNodeConfig, getSensorUnits,
} from '../../api/opcuaApi';
import type { NodeDef, NodeDefCreate, SensorUnit } from '../../api/opcuaApi';

// ── Empty form ─────────────────────────────────────────────────────────────────

const SIM_BEHAVIORS = [
  { value: 'sine',        label: 'Sine wave',    hint: 'Smooth oscillation between min and max' },
  { value: 'random_walk', label: 'Random walk',  hint: 'Noisy drift clamped to range' },
  { value: 'random',      label: 'Random',       hint: 'Uniform random in range each tick' },
  { value: 'sawtooth',    label: 'Sawtooth',     hint: 'Linear ramp min→max then reset (period = cycle time)' },
  { value: 'trapezoidal', label: 'Trapezoidal',  hint: 'Period = 1 phase. Cycle: ramp up → plateau → ramp down → off  (4 × period)' },
  { value: 'step',        label: 'Step',         hint: 'Toggles between min and max every period/2 s' },
  { value: 'constant',    label: 'Constant',     hint: 'Fixed value = min' },
  { value: 'threshold',   label: 'Threshold',    hint: 'Alarm: active when linked value crosses sim_max' },
];

const EMPTY: NodeDefCreate = {
  name: '', node_id: '', type: 'process', unit: '', description: '',
  is_active: true, sim_behavior: 'sine', sim_min: 0, sim_max: 100, sim_period: 30,
};

// ── Edit / Create Dialog ───────────────────────────────────────────────────────

function NodeDialog({
  open, initial, onClose, onSave, sensorUnits,
}: {
  open: boolean;
  initial: NodeDefCreate;
  onClose: () => void;
  onSave: (v: NodeDefCreate) => Promise<void>;
  sensorUnits: SensorUnit[];
}) {
  const [form, setForm] = useState<NodeDefCreate>(initial);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof NodeDefCreate, v: unknown) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name.trim() || !form.node_id.trim()) {
      toast.error('Name and Node ID are required');
      return;
    }
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{initial.name ? 'Edit Node' : 'Add Node'}</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: '16px !important' }}>
        <TextField label="Display Name" value={form.name} onChange={(e) => set('name', e.target.value)} required fullWidth size="small" />
        <TextField label="OPC-UA Node ID" value={form.node_id} onChange={(e) => set('node_id', e.target.value)} required fullWidth size="small" placeholder='ns=2;s="DB_ProcessData"."Temperature"' />
        <FormControl size="small" fullWidth>
          <InputLabel>Type</InputLabel>
          <Select value={form.type} label="Type" onChange={(e) => set('type', e.target.value)}>
            <MenuItem value="process">Process</MenuItem>
            <MenuItem value="alarm">Alarm</MenuItem>
          </Select>
        </FormControl>
        <Autocomplete
          freeSolo
          options={sensorUnits}
          groupBy={(o) => o.category}
          getOptionLabel={(o) => typeof o === 'string' ? o : `${o.unit} — ${o.description}`}
          value={sensorUnits.find((u) => u.unit === form.unit) ?? form.unit ?? ''}
          onChange={(_, v) => set('unit', v ? (typeof v === 'string' ? v : v.unit) : '')}
          onInputChange={(_, v) => set('unit', v)}
          renderInput={(params) => (
            <TextField {...params} label="Unit" size="small" placeholder="°C, bar, m³/h …" fullWidth />
          )}
        />
        <TextField label="Description" value={form.description ?? ''} onChange={(e) => set('description', e.target.value)} fullWidth size="small" multiline rows={2} />
        <FormControlLabel
          control={<Switch checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} />}
          label="Active (polled by OPC-UA service)"
        />

        <Typography variant="subtitle2" sx={{ mt: 1, mb: -1, color: 'text.secondary' }}>
          Simulator behavior
        </Typography>
        <FormControl size="small" fullWidth>
          <InputLabel>Behavior</InputLabel>
          <Select value={form.sim_behavior} label="Behavior" onChange={(e) => set('sim_behavior', e.target.value)}>
            {SIM_BEHAVIORS.map((b) => (
              <MenuItem key={b.value} value={b.value}>
                <Box>
                  <Typography variant="body2">{b.label}</Typography>
                  <Typography variant="caption" color="text.secondary">{b.hint}</Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField label="Min" type="number" size="small" fullWidth
            value={form.sim_min} onChange={(e) => set('sim_min', parseFloat(e.target.value) || 0)} />
          <TextField label="Max" type="number" size="small" fullWidth
            value={form.sim_max} onChange={(e) => set('sim_max', parseFloat(e.target.value) || 0)} />
          <TextField label="Period (s)" type="number" size="small" fullWidth
            value={form.sim_period} onChange={(e) => set('sim_period', parseFloat(e.target.value) || 0)}
            helperText="0 = N/A" /></Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={18} /> : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Confirm Delete Dialog ──────────────────────────────────────────────────────

function ConfirmDelete({ name, onConfirm, onClose }: { name: string; onConfirm: () => void; onClose: () => void }) {
  return (
    <Dialog open onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete node?</DialogTitle>
      <DialogContent>
        <Typography>Remove <strong>{name}</strong> from the node list?</Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={onConfirm} color="error" variant="contained">Delete</Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────

export default function NodeConfigPage() {
  const [nodes, setNodes]           = useState<NodeDef[]>([]);
  const [sensorUnits, setSensorUnits] = useState<SensorUnit[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [editTarget, setEditTarget] = useState<NodeDef | null>(null);
  const [addOpen, setAddOpen]       = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<NodeDef | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [nodeDefs, units] = await Promise.all([getNodeConfig(), getSensorUnits()]);
      setNodes(nodeDefs);
      setSensorUnits(units);
    } catch {
      setError('Failed to load node configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const handleCreate = async (form: NodeDefCreate) => {
    await createNodeConfig(form).then(() => { toast.success('Node created'); void load(); });
  };

  const handleUpdate = async (form: NodeDefCreate) => {
    if (!editTarget) return;
    await updateNodeConfig(editTarget.id, form).then(() => { toast.success('Node updated'); void load(); });
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteNodeConfig(deleteTarget.id);
      toast.success('Node deleted');
      setDeleteTarget(null);
      void load();
    } catch {
      toast.error('Delete failed');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" fontWeight={700}>Node Configuration</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAddOpen(true)}>
          Add Node
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Define which OPC-UA nodes the service polls. Changes take effect immediately.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Paper>
        {loading ? (
          <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress /></Box>
        ) : (
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>OPC-UA Node ID</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Unit</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Description</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="center">Active</TableCell>
                <TableCell sx={{ fontWeight: 700 }} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {nodes.map((n) => (
                <TableRow key={n.id} hover sx={{ opacity: n.is_active ? 1 : 0.5 }}>
                  <TableCell><Typography variant="body2" fontWeight={600}>{n.name}</Typography></TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={n.type}
                      color={n.type === 'alarm' ? 'error' : 'info'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Typography variant="caption" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>
                      {n.node_id}
                    </Typography>
                  </TableCell>
                  <TableCell>{n.unit ?? '—'}</TableCell>
                  <TableCell>{n.description ?? '—'}</TableCell>
                  <TableCell align="center">
                    <Chip size="small" label={n.is_active ? 'Yes' : 'No'} color={n.is_active ? 'success' : 'default'} />
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => setEditTarget(n)}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={() => setDeleteTarget(n)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
              {nodes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                    No nodes defined. Click "Add Node" to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Paper>

      {/* Add dialog */}
      <NodeDialog
        key={addOpen ? 'add-open' : 'add-closed'}
        open={addOpen}
        initial={EMPTY}
        onClose={() => setAddOpen(false)}
        onSave={handleCreate}
        sensorUnits={sensorUnits}
      />

      {/* Edit dialog */}
      {editTarget && (
        <NodeDialog
          key={editTarget.id}
          open
          initial={{
            name: editTarget.name, node_id: editTarget.node_id,
            type: editTarget.type, unit: editTarget.unit ?? '',
            description: editTarget.description ?? '', is_active: editTarget.is_active,
            sim_behavior: editTarget.sim_behavior, sim_min: editTarget.sim_min,
            sim_max: editTarget.sim_max, sim_period: editTarget.sim_period,
          }}
          onClose={() => setEditTarget(null)}
          onSave={handleUpdate}
          sensorUnits={sensorUnits}
        />
      )}

      {/* Delete confirm */}
      {deleteTarget && (
        <ConfirmDelete
          name={deleteTarget.name}
          onConfirm={() => void handleDelete()}
          onClose={() => setDeleteTarget(null)}
        />
      )}
    </Box>
  );
}
