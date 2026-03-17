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
import { VITE_APP_NAME, PAGE_SIGNIN_SUBTITLE } from '../features/config';

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
      navigate('/binpack');
    } catch (err: any) {
      toast.error(err?.detail ?? err ?? 'Sign in failed');
    }
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box
        sx={{
          display: { xs: 'none', sm: 'flex' },
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          bgcolor: 'grey.900',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
          }}
        />
        <Box sx={{ position: 'absolute', bottom: 48, left: 48, right: 48, color: 'white', zIndex: 1 }}>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            {VITE_APP_NAME}
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.8 }}>
            {PAGE_SIGNIN_SUBTITLE}
          </Typography>
        </Box>
      </Box>

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
          <Typography variant="h5" fontWeight={700} color="primary" gutterBottom>
            Welcome back
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Sign in to your account to continue.
          </Typography>

          <Box component="form" {...{ onSubmit: handleSubmit } as object}>
            <TextField
              fullWidth
              label="Username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              margin="normal"
              required
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
                      onMouseDown={(e: React.MouseEvent) => e.preventDefault()}
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
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ mt: 2, py: 1.2 }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
