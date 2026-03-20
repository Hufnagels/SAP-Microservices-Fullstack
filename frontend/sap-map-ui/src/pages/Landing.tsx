import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { VITE_APP_NAME } from '../features/config';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Left: video panel */}
      <Box
        component="video"
        src=""
        autoPlay
        muted
        loop
        playsInline
        sx={{
          width: 'calc(100vw - 420px)',
          height: '100vh',
          objectFit: 'cover',
          bgcolor: '#0d1117',
          flexShrink: 0,
        }}
      />

      {/* Right: CTA panel */}
      <Box
        sx={{
          width: 420,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          px: 4,
          backgroundImage: 'linear-gradient(to bottom, #0d1117, #161b22)',
          textAlign: 'center',
        }}
      >
        <Typography variant="h3" fontWeight={700} color="primary" gutterBottom>
          {VITE_APP_NAME}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 5 }}>
          SAP B1 data visualized on interactive maps
        </Typography>
        <Button
          variant="contained"
          size="large"
          fullWidth
          onClick={() => navigate('/signin')}
          sx={{ py: 1.5, fontSize: '1.1rem' }}
        >
          Sign In
        </Button>
      </Box>
    </Box>
  );
}
