/*
 * pages/users/UserAccount.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : "My Account" page that lets the currently logged-in user update
 *           their display name, email, and avatar (letter initials or cropped
 *           photo). Changes are persisted via PUT /users/me.
 *
 * Relationships
 *   Dispatches : authSlice.updateProfile thunk
 *   Reads      : state.auth.user  (name, email, role, avatar_mode, avatar_base64)
 *   Uses       : components/common/AvatarDropzone, AvatarCropDialog
 *
 * Key state
 *   name, email     – editable profile fields
 *   avatarMode      – 'letter' | 'image'
 *   savedAvatar     – base64 PNG string of the cropped avatar (null for letter mode)
 *   cropImage       – image URL passed into AvatarCropDialog when it opens
 *   editorOpen      – controls crop dialog visibility
 *   saving, saveMsg – async save state and user-facing feedback message
 */
import { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import ImageIcon from '@mui/icons-material/Image';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { toast } from 'react-toastify';
import { updateProfile } from '../../features/auth/authSlice';
import type { RootState, AppDispatch } from '../../app/store';
import AvatarDropzone from '../../components/common/HadlingAvatars/AvatarDropzone';
import AvatarCropDialog from '../../components/common/HadlingAvatars/AvatarCropDialog';

// ── Main page ─────────────────────────────────────────────────────────────────
export default function UserAccount() {
  const dispatch = useDispatch<AppDispatch>();
  const user = useSelector((state: RootState) => state.auth.user);

  const [name, setName] = useState(user?.name ?? 'Admin User');
  const [email, setEmail] = useState(user?.email ?? 'admin@example.com');

  // Avatar mode: 'letter' shows initials, 'image' shows the uploaded photo
  const [avatarMode, setAvatarMode] = useState<'letter' | 'image'>(
    user?.avatar_mode ?? 'letter'
  );
  const [savedAvatar, setSavedAvatar] = useState<string | null>(
    user?.avatar_base64 ?? null
  );

  // Crop dialog state
  const [editorOpen, setEditorOpen] = useState(false);
  const [cropImage, setCropImage]   = useState<string | null>(null);

  // Password
  const [showPassword, setShowPassword] = useState(false);

  const [saving, setSaving] = useState(false);

  // ── Avatar mode toggle ───────────────────────────────────────────────────
  const handleModeChange = (_: React.MouseEvent, value: 'letter' | 'image' | null) => {
    if (!value) return;
    setAvatarMode(value);
    if (value === 'letter') setSavedAvatar(null);
  };

  const openCropWith = (img: string) => { setCropImage(img); setEditorOpen(true); };

  // ── Save profile ─────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    try {
      await dispatch(updateProfile({
        name,
        email,
        avatar_mode: avatarMode,
        avatar_base64: avatarMode === 'image' ? savedAvatar : null,
      })).unwrap();
      toast.success('Profile saved successfully.');
    } catch (err: any) {
      toast.error(err?.detail ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  const initials = name[0]?.toUpperCase() ?? 'A';

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        My Account
      </Typography>

      <Grid container spacing={3}>
        {/* ── Left: profile card ── */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>

            {/* Mode toggle */}
            <ToggleButtonGroup
              value={avatarMode}
              exclusive
              size="small"
              onChange={handleModeChange}
              sx={{ mb: 2.5 }}
            >
              <ToggleButton value="letter">
                <TextFieldsIcon fontSize="small" sx={{ mr: 0.5 }} />
                Letter
              </ToggleButton>
              <ToggleButton value="image">
                <ImageIcon fontSize="small" sx={{ mr: 0.5 }} />
                Image
              </ToggleButton>
            </ToggleButtonGroup>

            {/* Avatar preview */}
            {avatarMode === 'letter' ? (
              <Avatar
                sx={{
                  width: 96, height: 96,
                  mx: 'auto', mb: 2,
                  bgcolor: 'primary.main',
                  fontSize: '2.5rem',
                }}
              >
                {initials}
              </Avatar>
            ) : savedAvatar ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1, mb: 2 }}>
                <Avatar src={savedAvatar} sx={{ width: 96, height: 96 }} />
                <Button size="small" variant="outlined" onClick={() => openCropWith(savedAvatar)}>
                  Change photo
                </Button>
              </Box>
            ) : (
              <Box sx={{ mb: 2 }}>
                <AvatarDropzone onFile={openCropWith} />
              </Box>
            )}

            <Typography variant="h6" fontWeight={600}>{name}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {email}
            </Typography>
            <Chip label={user?.role ?? 'admin'} color="primary" size="small" />
          </Paper>
        </Grid>

        {/* ── Right: settings form ── */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Profile Settings
            </Typography>
            <Divider sx={{ mb: 3 }} />

            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth label="Full Name"
                  value={name} onChange={(e) => setName(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  fullWidth label="Email" type="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField fullWidth label="Role" value={user?.role ?? 'admin'} disabled />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <FormControl fullWidth variant="outlined">
                  <InputLabel htmlFor="account-password">New Password</InputLabel>
                  <OutlinedInput
                    id="account-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Leave blank to keep current"
                    endAdornment={
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? 'hide the password' : 'display the password'}
                          onClick={() => setShowPassword((s) => !s)}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseUp={(e) => e.preventDefault()}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    }
                    label="New Password"
                  />
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Button
                  variant="contained"
                  disabled={saving}
                  onClick={handleSave}
                  sx={{ mt: 1 }}
                >
                  {saving ? <CircularProgress size={20} color="inherit" /> : 'Save Changes'}
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      {/* ── Avatar crop dialog ── */}
      <AvatarCropDialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onApply={(base64) => setSavedAvatar(base64)}
        image={cropImage}
        title="Edit Profile Photo"
      />
    </Box>
  );
}
