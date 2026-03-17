// src/pages/querys/QueryList.tsx

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  MaterialReactTable,
  useMaterialReactTable,
  type MRT_ColumnDef,
  type MRT_Row,
} from 'material-react-table';
import { Box, Tooltip, Typography, IconButton } from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { toast } from 'react-toastify';

import type { RootState, AppDispatch } from '../../app/store';
import { VITE_APP_API_URL } from '../../features/config';
import { fetchQueries, deleteQuery, type QueryDef } from '../../features/queries/queriesSlice';

interface ServiceRow { name: string; pascal_name: string | null }

function canEdit(
  user: { role: string; service_roles?: Record<string, string> } | null,
  svcName: string | null,
  permissions: Record<string, Record<string, string[]>>,
): boolean {
  if (!user) return false;
  // Global superadmin/admin can always edit, regardless of service_role overrides
  if (user.role === 'superadmin' || user.role === 'admin') return true;
  // For other roles, check effective role for this service
  const effRole = svcName ? ((user.service_roles ?? {})[svcName] ?? user.role) : user.role;
  if (effRole === 'forbidden') return false;
  const actions = svcName ? ((permissions[effRole] ?? {})[svcName] ?? []) : [];
  return actions.includes('update') || actions.includes('create');
}

export default function QueryList() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const token = useSelector((s: RootState) => s.auth.token);
  const user  = useSelector((s: RootState) => s.auth.user);
  const { items: queries, loading } = useSelector((s: RootState) => s.queries);
  const [serviceMap,  setServiceMap]  = useState<Record<string, string>>({});
  const [permissions, setPermissions] = useState<Record<string, Record<string, string[]>>>({});

  useEffect(() => {
    dispatch(fetchQueries()).unwrap().catch(() => toast.error('Failed to load queries'));
  }, [dispatch]);

  // Load services (for pascal_name display) + permissions (for edit gate)
  useEffect(() => {
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${VITE_APP_API_URL}/auth/services?active_only=true`, { headers }),
      axios.get(`${VITE_APP_API_URL}/auth/permissions`, { headers }),
    ]).then(([svcRes, permRes]) => {
      const map: Record<string, string> = {};
      (svcRes.data as ServiceRow[]).forEach((s) => { map[s.name] = s.pascal_name ?? s.name; });
      setServiceMap(map);
      setPermissions(permRes.data as Record<string, Record<string, string[]>>);
    }).catch(() => {/* non-critical */});
  }, [token]);

  const handleDelete = async (row: MRT_Row<QueryDef>) => {
    if (!confirm(`Delete query "${row.original.query_name}"?`)) return;
    try {
      await dispatch(deleteQuery(row.original.query_id)).unwrap();
      toast.success('Query deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const columns = useMemo<MRT_ColumnDef<QueryDef>[]>(() => [
    { accessorKey: 'query_id',    header: 'ID',           size: 70 },
    { accessorKey: 'query_name',  header: 'Name',         size: 180 },
    { accessorKey: 'description', header: 'Description',  size: 220 },
    {
      accessorKey: 'service_name',
      header: 'Service',
      size: 160,
      Cell: ({ cell }) => {
        const sn = cell.getValue<string | null>();
        return <>{sn ? (serviceMap[sn] ?? sn) : '—'}</>;
      },
    },
    { accessorKey: 'base_table',  header: 'Target Table', size: 160 },
    { accessorKey: 'created_at',  header: 'Created',      size: 150 },
  ], [serviceMap]);

  const table = useMaterialReactTable({
    columns,
    data: queries,
    getRowId: (row) => String(row.query_id),
    state: { isLoading: loading },
    initialState: { density: 'compact', pagination: { pageSize: 20, pageIndex: 0 } },
    enableColumnResizing: true,
    enableStickyHeader: true,
    muiTableContainerProps: { sx: { maxHeight: 'calc(100vh - 220px)' } },
    enableRowActions: true,
    positionActionsColumn: 'last',
    renderRowActions: ({ row }) => {
      const editable = canEdit(user, row.original.service_name, permissions);
      return (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title={editable ? 'Edit' : 'No permission'}>
            <span>
              <IconButton
                size="small"
                disabled={!editable}
                onClick={() => navigate(`/querys/builder?id=${row.original.query_id}`)}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={editable ? 'Delete' : 'No permission'}>
            <span>
              <IconButton size="small" color="error" disabled={!editable} onClick={() => handleDelete(row)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
      );
    },
  });

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>Query Definitions</Typography>
      <MaterialReactTable table={table} />
    </Box>
  );
}
