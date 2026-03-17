/*
 * pages/users/Users.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : User management table. Full CRUD aligned with auth_users DB schema.
 *           All backend interactions report result via react-toastify.
 *
 * Table columns : avatar+name, username, email, role, service_roles, status, joined
 * Form fields   : username (create only), name, email, role, service_roles, status,
 *                 password, avatar
 */
import { useEffect, useMemo, useState } from 'react';
import { MaterialReactTable, useMaterialReactTable } from 'material-react-table';
import type { MRT_ColumnDef } from 'material-react-table';
import { useDispatch, useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Chip from '@mui/material/Chip';
import Avatar from '@mui/material/Avatar';
import IconButton from '@mui/material/IconButton';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import LinearProgress from '@mui/material/LinearProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputAdornment from '@mui/material/InputAdornment';
import Divider from '@mui/material/Divider';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ImageIcon from '@mui/icons-material/Image';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { fetchUsers, createUser, updateUser, deleteUser } from '../../features/users/usersSlice';
import type { UserRow } from '../../features/users/usersSlice';
import type { RootState, AppDispatch } from '../../app/store';
import AvatarDropzone from '../../components/common/HadlingAvatars/AvatarDropzone';
import AvatarCropDialog from '../../components/common/HadlingAvatars/AvatarCropDialog';
import { getStrength } from '../../components/common/fuctions';

// ── Constants ─────────────────────────────────────────────────────────────────

const ROLE_RANK: Record<string, number> = { superadmin: 4, admin: 3, operator: 2, viewer: 1, worker: 0 };

const ROLES = ['superadmin', 'admin', 'operator', 'viewer', 'worker'] as const;

// Service-level role overrides — "forbidden" blocks access even if global role would allow it
const SERVICE_ROLES = ['superadmin', 'admin', 'operator', 'viewer', 'worker', 'forbidden'] as const;

const SERVICES = [
  'auth-service', 'sap-b1-adapter-service', 'file-service', 'binpack-service',
  'labeling-service', 'orders-service', 'inventory-service', 'reporting-service',
  'sensor-ingest-service', 'maps-service',
];

const ROLE_COLOR: Record<string, 'error' | 'warning' | 'info' | 'success' | 'default'> = {
  superadmin: 'error',
  admin:      'warning',
  operator:   'info',
  viewer:     'default',
  worker:     'success',
  forbidden:  'error',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Types ─────────────────────────────────────────────────────────────────────

type DialogTarget = UserRow | 'new' | null;

interface UserFormData {
  username: string;
  name: string;
  email: string;
  role: string;
  service_roles: Record<string, string>;
  status: string;
  password: string;
  avatar_mode: 'letter' | 'image';
  avatar_base64: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toForm(target: Exclude<DialogTarget, null>): UserFormData {
  if (target === 'new')
    return {
      username: '', name: '', email: '', role: 'viewer',
      service_roles: {}, status: 'active',
      password: '', avatar_mode: 'letter', avatar_base64: null,
    };
  return {
    username:      target.username,
    name:          target.name,
    email:         target.email,
    role:          target.role,
    service_roles: target.service_roles ?? {},
    status:        target.status,
    password:      '',
    avatar_mode:   target.avatar_mode ?? 'letter',
    avatar_base64: target.avatar_base64 ?? null,
  };
}

// ── UserDialog ────────────────────────────────────────────────────────────────

function UserDialog({ target, onClose, onSave }: {
  target: DialogTarget;
  onClose: () => void;
  onSave: (data: UserFormData) => void;
}) {
  const [form, setForm] = useState<UserFormData>({
    username: '', name: '', email: '', role: 'viewer',
    service_roles: {}, status: 'active',
    password: '', avatar_mode: 'letter', avatar_base64: null,
  });
  const [emailTouched, setEmailTouched] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [cropOpen, setCropOpen]         = useState(false);
  const [cropImage, setCropImage]       = useState<string | null>(null);

  useEffect(() => {
    if (target) {
      setForm(toForm(target));
      setEmailTouched(false);
      setShowPassword(false);
      setCropImage(null);
    }
  }, [target]);

  const set = (field: keyof UserFormData) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const setServiceRole = (service: string, role: string) =>
    setForm((prev) => {
      const sr = { ...prev.service_roles };
      if (role === '') delete sr[service];
      else sr[service] = role;
      return { ...prev, service_roles: sr };
    });

  const openCropWith = (img: string) => { setCropImage(img); setCropOpen(true); };

  const isNew      = target === 'new';
  const emailError = emailTouched && !EMAIL_RE.test(form.email);
  const strength   = getStrength(form.password);
  const canSave    =
    (!isNew || form.username.trim().length > 0) &&
    EMAIL_RE.test(form.email) &&
    (!isNew || form.password.length > 0);
  const initials   = form.name?.[0]?.toUpperCase() ?? '?';

  return (
    <>
      <Dialog open={target !== null} onClose={onClose} maxWidth="sm" fullWidth>
        <DialogTitle>{isNew ? 'Add User' : 'Edit User'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>

            {/* Avatar */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.75, display: 'block' }}>
                Avatar
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
                {form.avatar_mode === 'image' && form.avatar_base64 ? (
                  <Avatar src={form.avatar_base64} sx={{ width: 56, height: 56, mt: 0.5 }} />
                ) : (
                  <Avatar sx={{ width: 56, height: 56, mt: 0.5, bgcolor: 'primary.main', fontSize: '1.4rem' }}>
                    {initials}
                  </Avatar>
                )}
                <Stack spacing={1} sx={{ flex: 1 }}>
                  <ToggleButtonGroup
                    value={form.avatar_mode}
                    exclusive
                    size="small"
                    onChange={(_, v) => {
                      if (v) setForm((p) => ({ ...p, avatar_mode: v, avatar_base64: v === 'letter' ? null : p.avatar_base64 }));
                    }}
                  >
                    <ToggleButton value="letter">
                      <TextFieldsIcon fontSize="small" sx={{ mr: 0.5 }} />Letter
                    </ToggleButton>
                    <ToggleButton value="image">
                      <ImageIcon fontSize="small" sx={{ mr: 0.5 }} />Image
                    </ToggleButton>
                  </ToggleButtonGroup>
                  {form.avatar_mode === 'image' && (
                    form.avatar_base64 ? (
                      <Button size="small" variant="outlined" sx={{ alignSelf: 'flex-start' }}
                        onClick={() => openCropWith(form.avatar_base64!)}>
                        Change photo
                      </Button>
                    ) : (
                      <AvatarDropzone onFile={openCropWith} />
                    )
                  )}
                </Stack>
              </Box>
            </Box>

            {/* Username — required for create, read-only for edit */}
            <TextField
              label="Username"
              value={form.username}
              onChange={set('username')}
              size="small"
              fullWidth
              required={isNew}
              disabled={!isNew}
              helperText={isNew ? 'Login name — cannot be changed later' : undefined}
            />

            <TextField label="Name"  value={form.name}  onChange={set('name')}  size="small" fullWidth />
            <TextField
              label="Email"
              value={form.email}
              onChange={set('email')}
              onBlur={() => setEmailTouched(true)}
              size="small"
              fullWidth
              type="email"
              error={emailError}
              helperText={emailError ? 'Enter a valid email address' : undefined}
            />

            <TextField label="Global Role" value={form.role} onChange={set('role')} size="small" fullWidth select>
              {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>

            <TextField label="Status" value={form.status} onChange={set('status')} size="small" fullWidth select>
              {['active', 'inactive'].map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
            </TextField>

            {/* Service role overrides */}
            <Box>
              <Divider sx={{ mb: 1.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Service Role Overrides (blank = inherit global role)
                </Typography>
              </Divider>
              <Stack spacing={1}>
                {SERVICES.map((svc) => (
                  <TextField
                    key={svc}
                    label={svc}
                    value={form.service_roles[svc] ?? ''}
                    onChange={(e) => setServiceRole(svc, e.target.value)}
                    size="small"
                    fullWidth
                    select
                  >
                    <MenuItem value=""><em>— inherit global —</em></MenuItem>
                    {SERVICE_ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
                  </TextField>
                ))}
              </Stack>
            </Box>

            {/* Password + strength */}
            <Box>
              <FormControl fullWidth size="small" variant="outlined">
                <InputLabel htmlFor="user-dialog-password">
                  {isNew ? 'Password' : 'New Password'}
                </InputLabel>
                <OutlinedInput
                  id="user-dialog-password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={set('password')}
                  placeholder={isNew ? '' : 'Leave blank to keep current'}
                  endAdornment={
                    <InputAdornment position="end">
                      <IconButton
                        onClick={() => setShowPassword((s) => !s)}
                        onMouseDown={(e) => e.preventDefault()}
                        edge="end"
                        size="small"
                      >
                        {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                      </IconButton>
                    </InputAdornment>
                  }
                  label={isNew ? 'Password' : 'New Password'}
                />
              </FormControl>
              {form.password && (
                <Box sx={{ mt: 0.75 }}>
                  <LinearProgress
                    variant="determinate"
                    value={(strength.score / 4) * 100}
                    sx={{
                      height: 5, borderRadius: 3, bgcolor: 'divider',
                      '& .MuiLinearProgress-bar': { bgcolor: strength.color, transition: 'none' },
                    }}
                  />
                  <Typography variant="caption" sx={{ color: strength.color }}>
                    {strength.label} — use 8+ chars, uppercase, number and symbol
                  </Typography>
                </Box>
              )}
            </Box>

          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="contained" disabled={!canSave} onClick={() => onSave(form)}>Save</Button>
        </DialogActions>
      </Dialog>

      <AvatarCropDialog
        open={cropOpen}
        onClose={() => setCropOpen(false)}
        onApply={(base64) => setForm((p) => ({ ...p, avatar_base64: base64 }))}
        image={cropImage}
        title="Edit Photo"
      />
    </>
  );
}

// ── UsersPage ─────────────────────────────────────────────────────────────────

export default function UsersPage() {
  const dispatch = useDispatch<AppDispatch>();
  const data     = useSelector((s: RootState) => s.users.list);
  const loading  = useSelector((s: RootState) => s.users.loading);
  const currentUserRole = useSelector((s: RootState) => s.auth.user?.role ?? 'viewer');
  const currentUserId   = useSelector((s: RootState) => s.auth.user?.id ?? -1);
  const [dialogTarget, setDialogTarget] = useState<DialogTarget>(null);

  useEffect(() => {
    if (data.length === 0) dispatch(fetchUsers());
  }, [dispatch, data.length]);

  const handleSave = async (form: UserFormData) => {
    const { password, ...rest } = form;
    const payload = { ...rest, ...(password ? { password } : {}) };
    try {
      if (dialogTarget === 'new') {
        await dispatch(createUser({ ...payload, joined: '' })).unwrap();
        toast.success(`User "${form.username}" created`);
      } else if (dialogTarget) {
        await dispatch(updateUser({ ...dialogTarget, ...payload })).unwrap();
        toast.success(`User "${form.name}" updated`);
      }
      setDialogTarget(null);
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : err?.message ?? 'Operation failed');
    }
  };

  const handleDelete = async (row: UserRow) => {
    try {
      await dispatch(deleteUser(row.id)).unwrap();
      toast.success(`User "${row.name}" deleted`);
    } catch (err: any) {
      toast.error(typeof err === 'string' ? err : err?.message ?? 'Delete failed');
    }
  };

  const columns = useMemo<MRT_ColumnDef<UserRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'User',
        Cell: ({ row }) => (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            {row.original.avatar_mode === 'image' && row.original.avatar_base64 ? (
              <Avatar src={row.original.avatar_base64} sx={{ width: 32, height: 32 }} />
            ) : (
              <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.85rem' }}>
                {row.original.name?.[0]?.toUpperCase() ?? '?'}
              </Avatar>
            )}
            <Box>
              <Typography variant="body2" fontWeight={500}>{row.original.name}</Typography>
              <Typography variant="caption" color="text.secondary">{row.original.email}</Typography>
            </Box>
          </Box>
        ),
      },
      { accessorKey: 'username', header: 'Username' },
      {
        accessorKey: 'role',
        header: 'Role',
        Cell: ({ cell }) => {
          const role = cell.getValue<string>();
          return <Chip label={role} size="small" color={ROLE_COLOR[role] ?? 'default'} />;
        },
      },
      {
        id: 'service_roles',
        header: 'Service Roles',
        Cell: ({ row }) => {
          const sr: Record<string, string> = row.original.service_roles ?? {};
          const globalRole = row.original.role;
          return (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
              {SERVICES.map((svc) => {
                const override = sr[svc];
                const effective = override ?? globalRole;
                const isOverride = Boolean(override);
                const isForbidden = effective === 'forbidden';
                return (
                  <Chip
                    key={svc}
                    label={`${svc.replace('-service', '')}: ${effective}`}
                    size="small"
                    variant={isOverride ? 'filled' : 'outlined'}
                    color={ROLE_COLOR[effective] ?? 'default'}
                    sx={{
                      opacity: isForbidden ? 0.75 : 1,
                      textDecoration: isForbidden ? 'line-through' : undefined,
                      fontStyle: isOverride ? 'normal' : 'italic',
                    }}
                  />
                );
              })}
            </Box>
          );
        },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        Cell: ({ cell }) => (
          <Chip
            label={cell.getValue<string>()}
            size="small"
            color={cell.getValue<string>() === 'active' ? 'success' : 'default'}
          />
        ),
      },
      {
        accessorKey: 'joined',
        header: 'Joined',
        Cell: ({ cell }) => (
          <Typography variant="caption">
            {cell.getValue<string>() ? new Date(cell.getValue<string>()).toLocaleDateString() : '—'}
          </Typography>
        ),
      },
    ],
    []
  );

  const table = useMaterialReactTable({
    columns,
    data,
    enableColumnFilters: true,
    enableGlobalFilter: true,
    enableSorting: true,
    enablePagination: true,
    enableRowActions: true,
    positionActionsColumn: 'last',
    state: { isLoading: loading },
    initialState: {
      pagination: { pageSize: 10, pageIndex: 0 },
      showGlobalFilter: true,
      density: 'compact',
    },
    muiSearchTextFieldProps: { placeholder: 'Search users…', size: 'small', sx: { width: 280 } },
    muiPaginationProps: { rowsPerPageOptions: [5, 10, 25] },
    renderRowActions: ({ row }) => {
      const isSelf    = row.original.id === currentUserId;
      const canModify = isSelf || ROLE_RANK[currentUserRole] >= ROLE_RANK[row.original.role ?? 'viewer'];
      return (
        <Box sx={{ display: 'flex' }}>
          <IconButton size="small" disabled={!canModify} onClick={() => setDialogTarget(row.original)}>
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" disabled={!canModify} onClick={() => handleDelete(row.original)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Box>
      );
    },
    renderTopToolbarCustomActions: () => (
      <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={() => setDialogTarget('new')}>
        Add User
      </Button>
    ),
  });

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Users
      </Typography>
      <MaterialReactTable table={table} />
      <UserDialog
        target={dialogTarget}
        onClose={() => setDialogTarget(null)}
        onSave={handleSave}
      />
    </Box>
  );
}
