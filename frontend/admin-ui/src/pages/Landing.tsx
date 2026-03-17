/*
 * pages/Landing.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Public landing page — the first screen visitors see. Shows the
 *           app name and a single "Sign In" call-to-action button.
 *
 * Relationships
 *   Routes to : /signin  (SignIn.tsx)
 *   Uses      : features/config (VITE_APP_NAME)
 *
 * No Redux state — purely presentational.
 */
import { useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import { VITE_APP_NAME } from '../features/config';

export default function Landing() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: 'background.default',
        textAlign: 'center',
        px: 2,
        backgroundImage: 'linear-gradient(to bottom, #0c0e0e, #0f1513)',
      }}
    >
      <Container maxWidth="md">
        <Typography variant="h2" fontWeight={700} color="primary" gutterBottom>
          {VITE_APP_NAME}
        </Typography>
        <Typography variant="h5" color="text.secondary" sx={{ mb: 5 }}>
          A modern, reusable React admin template with authentication, charts, tables, and more.
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={() => navigate('/signin')}
          sx={{ px: 5, py: 1.5, fontSize: '1.1rem' }}
        >
          Sign In
        </Button>
      </Container>
    </Box>
  );
}
