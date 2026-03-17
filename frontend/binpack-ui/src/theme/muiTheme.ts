import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#33338f',
      light: '#5c5cb8',
      dark: '#1a1a6e',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6b7280',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  shape: { borderRadius: 8 },
});

export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#7986cb',
      light: '#aab6fb',
      dark: '#49599a',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9fa8da',
    },
    background: {
      default: '#0d0d1a',
      paper: '#1a1a2e',
    },
  },
  shape: { borderRadius: 8 },
});
