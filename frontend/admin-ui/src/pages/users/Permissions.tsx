/*
 * pages/users/Permissions.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Role permissions editor. Rows = services (from auth_db services table).
 *           Columns = roles. Each cell has CRUD action checkboxes.
 *           Superadmin-only save.
 *
 * Backend : GET /auth/services    — resource list (any authenticated)
 *           GET /auth/permissions — current map (any authenticated)
 *           PUT /auth/permissions — save map (superadmin only)
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import { toast } from 'react-toastify';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Checkbox from '@mui/material/Checkbox';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Chip from '@mui/material/Chip';
import SaveIcon from '@mui/icons-material/Save';
import { fetchPermissions, savePermissions } from '../../features/permissions/permissionsSlice';
import type { PermissionsMap } from '../../features/permissions/permissionsSlice';
import type { RootState, AppDispatch } from '../../app/store';
import { VITE_APP_API_URL } from '../../features/config';

const ACTIONS = ['create', 'read', 'update', 'delete'] as const;
const ROLES   = ['superadmin', 'admin', 'operator', 'viewer', 'worker'] as const;

const ROLE_COLORS: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  superadmin: 'error',
  admin:      'warning',
  operator:   'info',
  viewer:     'default',
  worker:     'success',
};

interface ServiceRow { id: number; name: string; description: string | null }

export default function Permissions() {
  const dispatch    = useDispatch<AppDispatch>();
  const stored      = useSelector((s: RootState) => s.permissions.data);
  const loading     = useSelector((s: RootState) => s.permissions.loading);
  const saving      = useSelector((s: RootState) => s.permissions.saving);
  const token       = useSelector((s: RootState) => s.auth.token);
  const currentRole = useSelector((s: RootState) => s.auth.user?.role ?? 'viewer');

  const isSuperAdmin = currentRole === 'superadmin';

  const [local,    setLocal]    = useState<PermissionsMap>({});
  const [services, setServices] = useState<ServiceRow[]>([]);

  // Load permissions + services in parallel
  useEffect(() => {
    dispatch(fetchPermissions());
    axios
      .get(`${VITE_APP_API_URL}/auth/services?active_only=true`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((r) => setServices(r.data as ServiceRow[]))
      .catch(() => toast.error('Failed to load services list'));
  }, [dispatch, token]);

  useEffect(() => {
    setLocal(JSON.parse(JSON.stringify(stored)));
  }, [stored]);

  const hasAction = (role: string, resource: string, action: string) =>
    (local[role]?.[resource] ?? []).includes(action);

  const toggle = (role: string, resource: string, action: string) => {
    if (!isSuperAdmin) return;
    setLocal((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as PermissionsMap;
      if (!next[role])           next[role] = {};
      if (!next[role][resource]) next[role][resource] = [];
      const arr = next[role][resource];
      const idx = arr.indexOf(action);
      if (idx >= 0) arr.splice(idx, 1);
      else          arr.push(action);
      return next;
    });
  };

  const handleSave = async () => {
    try {
      await dispatch(savePermissions(local)).unwrap();
      toast.success('Permissions saved.');
    } catch (err: any) {
      toast.error(err?.detail ?? err ?? 'Failed to save permissions.');
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h5" fontWeight={700}>
          Role Permissions
        </Typography>
        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving}
          >
            Save Changes
          </Button>
        )}
      </Box>

      {!isSuperAdmin && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Read-only view. Only superadmin can modify permissions.
        </Typography>
      )}

      <TableContainer component={Paper} variant="outlined">
        <Table size="small" sx={{ minWidth: 800 }}>
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700, minWidth: 180 }}>Service</TableCell>
              <TableCell sx={{ fontWeight: 700, minWidth: 80 }}>Action</TableCell>
              {ROLES.map((role) => (
                <TableCell key={role} align="center" sx={{ minWidth: 100 }}>
                  <Chip
                    label={role}
                    size="small"
                    color={ROLE_COLORS[role] ?? 'default'}
                    sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                  />
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {services.map((svc) =>
              ACTIONS.map((action, ai) => (
                <TableRow
                  key={`${svc.name}-${action}`}
                  sx={{
                    '&:hover': { bgcolor: 'action.hover' },
                    borderTop: ai === 0 ? '2px solid' : undefined,
                    borderTopColor: ai === 0 ? 'divider' : undefined,
                  }}
                >
                  {ai === 0 && (
                    <TableCell
                      rowSpan={ACTIONS.length}
                      sx={{ fontWeight: 600, verticalAlign: 'middle' }}
                    >
                      {svc.name}
                      {svc.description && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          {svc.description}
                        </Typography>
                      )}
                    </TableCell>
                  )}
                  <TableCell sx={{ color: 'text.secondary', textTransform: 'capitalize' }}>
                    {action}
                  </TableCell>
                  {ROLES.map((role) => (
                    <TableCell key={role} align="center" padding="checkbox">
                      <Checkbox
                        checked={hasAction(role, svc.name, action)}
                        onChange={() => toggle(role, svc.name, action)}
                        disabled={!isSuperAdmin}
                        size="small"
                        color={ROLE_COLORS[role] ?? 'default'}
                      />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
