// src/pages/services/ServiceList.tsx
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import axios from 'axios';
import {
  MaterialReactTable, useMaterialReactTable, type MRT_ColumnDef,
} from 'material-react-table';
import {
  Box, Typography, Chip, IconButton, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Stack, Switch, FormControlLabel,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import TuneIcon from '@mui/icons-material/Tune';
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

interface EditForm {
  pascal_name: string;
  description: string;
  service_url: string;
  port: string;
  make_command: string;
  api_endpoint: string;
  is_active: boolean;
}

export default function ServiceList() {
  const navigate = useNavigate();
  const token = useSelector((s: RootState) => s.auth.token);
  const user  = useSelector((s: RootState) => s.auth.user);

  const [services,   setServices]   = useState<Service[]>([]);
  const [healthMap,  setHealthMap]  = useState<Record<string, 'up' | 'down' | 'checking'>>({});
  const [loading,    setLoading]    = useState(true);
  const [editOpen,  setEditOpen]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [selected,  setSelected]  = useState<Service | null>(null);
  const [form,      setForm]      = useState<EditForm>({
    pascal_name: '', description: '', service_url: '',
    port: '', make_command: '', api_endpoint: '', is_active: true,
  });

  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const canEdit = user?.role === 'superadmin' || user?.role === 'admin';

  const fetchServices = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Service[]>('/auth/services', { headers });
      setServices(res.data);
      // ping health for each service
      const init: Record<string, 'up' | 'down' | 'checking'> = {};
      res.data.forEach((s) => { if (s.api_endpoint) init[s.name] = 'checking'; });
      setHealthMap(init);
      res.data.forEach(async (svc) => {
        if (!svc.api_endpoint) return;
        try {
          await axios.get(`${svc.api_endpoint}/health`, { timeout: 5000 });
          setHealthMap((prev) => ({ ...prev, [svc.name]: 'up' }));
        } catch {
          setHealthMap((prev) => ({ ...prev, [svc.name]: 'down' }));
        }
      });
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : 'Failed to load services';
      toast.error(String(msg ?? 'Failed to load services'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchServices(); }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  const openEdit = (svc: Service) => {
    setSelected(svc);
    setForm({
      pascal_name:  svc.pascal_name  ?? '',
      description:  svc.description  ?? '',
      service_url:  svc.service_url  ?? '',
      port:         svc.port != null ? String(svc.port) : '',
      make_command: svc.make_command ?? '',
      api_endpoint: svc.api_endpoint ?? '',
      is_active:    svc.is_active,
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await axios.put(`/auth/services/${selected.id}`, {
        pascal_name:  form.pascal_name  || null,
        description:  form.description  || null,
        service_url:  form.service_url  || null,
        port:         form.port !== '' ? Number(form.port) : null,
        make_command: form.make_command || null,
        api_endpoint: form.api_endpoint || null,
        is_active:    form.is_active,
      }, { headers });
      toast.success(`Service "${selected.name}" updated`);
      setEditOpen(false);
      fetchServices();
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) ? err.response?.data?.detail : 'Save failed';
      toast.error(String(msg ?? 'Save failed'));
    } finally {
      setSaving(false);
    }
  };

  const columns = useMemo<MRT_ColumnDef<Service>[]>(() => [
    { accessorKey: 'id',           header: 'ID',            size: 60  },
    { accessorKey: 'name',         header: 'Name',          size: 140 },
    { accessorKey: 'pascal_name',  header: 'Pascal Name',   size: 140, Cell: ({ cell }) => cell.getValue<string | null>() ?? '—' },
    { accessorKey: 'service_url',  header: 'URL',           size: 180, Cell: ({ cell }) => cell.getValue<string | null>() ?? '—' },
    { accessorKey: 'port',         header: 'Port',          size: 80,  Cell: ({ cell }) => cell.getValue<number | null>() ?? '—' },
    { accessorKey: 'api_endpoint', header: 'API Endpoint',  size: 200, Cell: ({ cell }) => cell.getValue<string | null>() ?? '—' },
    {
      id: 'status',
      header: 'Status',
      size: 100,
      Cell: ({ row }) => {
        const svc = row.original;
        const h = healthMap[svc.name];
        if (!svc.api_endpoint) return <Chip label="No endpoint" size="small" />;
        if (!h || h === 'checking') return <Chip label="…" size="small" />;
        return <Chip label={h.toUpperCase()} color={h === 'up' ? 'success' : 'error'} size="small" />;
      },
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      enableSorting: false,
      enableColumnFilter: false,
      Cell: ({ row }) => (
        <Stack direction="row" spacing={0.5}>
          <Tooltip title={canEdit ? 'Edit service' : 'No permission'}>
            <span>
              <IconButton
                size="small"
                disabled={!canEdit}
                onClick={() => openEdit(row.original)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Manage service">
            <IconButton
              size="small"
              onClick={() => navigate(`/services/manage?name=${row.original.name}`)}
            >
              <TuneIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      ),
    },
  ], [canEdit, navigate, healthMap]);

  const table = useMaterialReactTable({
    columns,
    data: services,
    state: { isLoading: loading },
    enableDensityToggle: false,
    initialState: { density: 'compact', pagination: { pageSize: 20, pageIndex: 0 } },
    muiTablePaperProps: { elevation: 0, variant: 'outlined' },
  });

  return (
    <Box>
      <Typography variant="h5" fontWeight={700} sx={{ mb: 3 }}>
        Service List
      </Typography>

      <MaterialReactTable table={table} />

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Edit Service — {selected?.name}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Pascal Name"
              value={form.pascal_name}
              onChange={(e) => setForm((f) => ({ ...f, pascal_name: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              fullWidth
              multiline
              minRows={2}
            />
            <TextField
              label="Service URL"
              value={form.service_url}
              onChange={(e) => setForm((f) => ({ ...f, service_url: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Port"
              type="number"
              value={form.port}
              onChange={(e) => setForm((f) => ({ ...f, port: e.target.value }))}
              fullWidth
            />
            <TextField
              label="Make Command"
              value={form.make_command}
              onChange={(e) => setForm((f) => ({ ...f, make_command: e.target.value }))}
              fullWidth
            />
            <TextField
              label="API Endpoint"
              value={form.api_endpoint}
              onChange={(e) => setForm((f) => ({ ...f, api_endpoint: e.target.value }))}
              fullWidth
            />
            <FormControlLabel
              control={
                <Switch
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
              }
              label="Active"
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditOpen(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} variant="contained" disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
