import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import OutlinedInput from '@mui/material/OutlinedInput';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import Visibility from '@mui/icons-material/Visibility';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import { toast } from 'react-toastify';
import { signIn, fetchCurrentUser } from '../features/auth/authSlice';
import type { AppDispatch, RootState } from '../app/store';
import { VITE_APP_NAME, PAGE_SINGIN_SUBTILE } from '../features/config';

export default function SignIn() {
  const dispatch = useDispatch<AppDispatch>();
  const navigate = useNavigate();
  const { loading } = useSelector((state: RootState) => state.auth);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await dispatch(signIn({ username, password })).unwrap();
      await dispatch(fetchCurrentUser());
      navigate('/map');
    } catch (err: any) {
      toast.error(err?.detail ?? 'Sign in failed');
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>

      {/* Left panel */}
      <Box
        sx={{
          display: { xs: 'none', sm: 'flex' },
          width: 'calc(100vw - 420px)',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          bgcolor: 'grey.900',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <video
          autoPlay loop muted playsInline
          style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.7 }}
        >
          <source src="/demo.mp4" type="video/mp4" />
        </video>
        <Box sx={{ position: 'absolute', bottom: 48, left: 48, right: 48, color: 'white' }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>{VITE_APP_NAME}</Typography>
          <Typography variant="body1" sx={{ opacity: 0.8 }}>{PAGE_SINGIN_SUBTILE}</Typography>
        </Box>
      </Box>

      {/* Right panel: login form */}
      <Box
        sx={{
          width: { xs: '100%', sm: '420px' },
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 5,
          py: 6,
          bgcolor: 'background.default',
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 340 }}>
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <img src="/app-icon.jpg" alt="App icon" style={{ width: 300, height: 300, borderRadius: 24, objectFit: 'cover' }} />
          </Box>
          <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
            Welcome back
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in to your account to continue.
          </Typography>

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth label="Username" type="text" variant="outlined"
              value={username} onChange={(e) => setUsername(e.target.value)}
              margin="normal" required
            />
            <FormControl fullWidth margin="normal" required variant="outlined">
              <InputLabel htmlFor="signin-password">Password</InputLabel>
              <OutlinedInput
                id="signin-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((s) => !s)}
                      onMouseDown={(e) => e.preventDefault()}
                      edge="end"
                    >
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                }
                label="Password"
              />
            </FormControl>
            <Button
              type="submit" fullWidth variant="contained" size="large"
              disabled={loading} sx={{ mt: 2, py: 1.2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
