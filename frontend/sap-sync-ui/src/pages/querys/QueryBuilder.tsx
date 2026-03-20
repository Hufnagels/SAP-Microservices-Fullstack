// src/pages/querys/QueryBuilder.tsx

import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import axios from 'axios';
import {
  Box, Typography, TextField, Button, Paper, Stack, Divider, CircularProgress,
  MenuItem,
} from '@mui/material';
import { toast } from 'react-toastify';

import type { RootState, AppDispatch } from '../../app/store';
import { VITE_APP_API_URL } from '../../features/config';
import {
  fetchQueries,
  createQuery,
  updateQuery,
} from '../../features/queries/queriesSlice';

interface ServiceRow { id: number; name: string; pascal_name: string | null }

function canAccessService(
  user: { role: string; service_roles?: Record<string, string> },
  svcName: string,
  permissions: Record<string, Record<string, string[]>>,
): boolean {
  const effRole = (user.service_roles ?? {})[svcName] ?? user.role;
  if (effRole === 'forbidden') return false;
  const svcPerms = (permissions[effRole] ?? {})[svcName] ?? [];
  return svcPerms.length > 0;
}

export default function QueryBuilder() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get('id') ? Number(params.get('id')) : null;

  const token       = useSelector((s: RootState) => s.auth.token);
  const user        = useSelector((s: RootState) => s.auth.user);
  const existing    = useSelector((s: RootState) =>
    editId ? s.queries.items.find((q) => q.query_id === editId) : undefined,
  );

  const [queryName,    setQueryName]    = useState('');
  const [dstTable,     setDstTable]     = useState('');
  const [description,  setDescription]  = useState('');
  const [sqlOrig,      setSqlOrig]      = useState('');
  const [serviceName,  setServiceName]  = useState('');
  const [preview,      setPreview]      = useState<{ base: string; extra: string } | null>(null);
  const [saving,       setSaving]       = useState(false);
  const [services, setServices] = useState<ServiceRow[]>([]);

  // Load permissions + services the user has access to
  useEffect(() => {
    if (!token || !user) return;
    const headers = { Authorization: `Bearer ${token}` };
    Promise.all([
      axios.get(`${VITE_APP_API_URL}/auth/services?active_only=true`, { headers }),
      axios.get(`${VITE_APP_API_URL}/auth/permissions`, { headers }),
    ]).then(([svcRes, permRes]) => {
      const perms = permRes.data as Record<string, Record<string, string[]>>;
      const allowed = (svcRes.data as ServiceRow[]).filter((svc) =>
        canAccessService(user, svc.name, perms),
      );
      setServices(allowed);
    }).catch(() => toast.error('Failed to load services'));
  }, [token, user]);

  // Load existing query into form
  useEffect(() => {
    if (editId && !existing) dispatch(fetchQueries());
  }, [editId, existing, dispatch]);

  useEffect(() => {
    if (existing) {
      setQueryName(existing.query_name);
      setDstTable(existing.base_table ?? '');
      setDescription(existing.description ?? '');
      setSqlOrig(existing.sql_original ?? '');
      setServiceName(existing.service_name ?? '');
      if (existing.sql_b1_comp_base_query) {
        setPreview({
          base:  existing.sql_b1_comp_base_query,
          extra: existing.sql_b1_comp_extra_options ?? '[]',
        });
      }
    } else if (!editId) {
      setQueryName('');
      setDstTable('');
      setDescription('');
      setSqlOrig('');
      setServiceName('');
      setPreview(null);
    }
  }, [existing, editId]);

  const handleSave = async () => {
    if (!queryName.trim() || !sqlOrig.trim()) {
      toast.warn('Name and SQL are required');
      return;
    }
    if (queryName.length > 20) {
      toast.warn('Query name must be ≤ 20 characters (SAP B1 limit)');
      return;
    }
    setSaving(true);
    try {
      const body = {
        query_name:   queryName,
        dst_table:    dstTable,
        description,
        sql_original: sqlOrig,
        service_name: serviceName || null,
        username:     user?.username,
      };
      let result: { sql_b1_comp_base_query?: string; sql_b1_comp_extra_options?: string };
      if (editId) {
        result = await dispatch(updateQuery({ id: editId, body })).unwrap();
        toast.success('Query updated');
      } else {
        result = await dispatch(createQuery(body)).unwrap();
        toast.success('Query saved');
      }
      setPreview({
        base:  result.sql_b1_comp_base_query ?? '',
        extra: result.sql_b1_comp_extra_options ?? '[]',
      });
      if (!editId) navigate('/querys/list');
    } catch (err: unknown) {
      const msg = (err as { detail?: string })?.detail ?? 'Save failed';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ p: 2, maxWidth: 960 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {editId ? 'Edit Query' : 'New Query'}
      </Typography>

      <Stack spacing={2}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Query name"
            value={queryName}
            onChange={(e) => setQueryName(e.target.value)}
            fullWidth
            inputProps={{ maxLength: 20 }}
            error={queryName.length > 20}
            helperText={
              queryName.length > 20
                ? `${queryName.length}/20 — SAP B1 SqlCode max 20 chars`
                : `${queryName.length}/20`
            }
          />
          <TextField
            label="Target table (dst)"
            value={dstTable}
            onChange={(e) => setDstTable(e.target.value)}
            fullWidth
            placeholder="EXCEL"
            helperText={!dstTable.trim() ? 'Empty = EXCEL export only (no DB sync)' : undefined}
          />
        </Stack>

        <Stack direction="row" spacing={2}>
          <TextField
            label="Service"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
            select
            fullWidth
            helperText="Service this query belongs to"
          >
            <MenuItem value=""><em>— none —</em></MenuItem>
            {services.map((svc) => (
              <MenuItem key={svc.name} value={svc.name}>
                {svc.pascal_name ?? svc.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            placeholder="Short description of what this query retrieves"
          />
        </Stack>

        <TextField
          label="SQL (original)"
          value={sqlOrig}
          onChange={(e) => setSqlOrig(e.target.value)}
          multiline
          minRows={8}
          fullWidth
          inputProps={{ style: { fontFamily: 'monospace', fontSize: 13 } }}
          helperText="Write raw SQL — arithmetic expressions, CAST, CONCAT date patterns, etc. are transformed automatically."
        />

        <Button
          variant="contained"
          onClick={handleSave}
          disabled={saving}
          startIcon={saving ? <CircularProgress size={16} /> : undefined}
          sx={{ alignSelf: 'flex-start' }}
        >
          {editId ? 'Save changes' : 'Save query'}
        </Button>
      </Stack>

      {preview && (
        <>
          <Divider sx={{ my: 3 }} />
          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            SAP B1-compatible query (generated)
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default', mb: 2 }}>
            <Typography
              component="pre"
              sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', m: 0 }}
            >
              {preview.base}
            </Typography>
          </Paper>

          <Typography variant="subtitle1" fontWeight={700} sx={{ mb: 1 }}>
            Computed columns (post-fetch, stored as JSON)
          </Typography>
          <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.default' }}>
            <Typography
              component="pre"
              sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', m: 0 }}
            >
              {(() => { try { return JSON.stringify(JSON.parse(preview.extra), null, 2); } catch { return preview.extra; } })()}
            </Typography>
          </Paper>
        </>
      )}
    </Box>
  );
}
