import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#f97316',
      light: '#fb923c',
      dark: '#ea580c',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6b7280',
    },
    background: {
      default: '#f9fafb',
      paper: '#ffffff',
    },
  },
  shape: { borderRadius: 8 },
});

export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#f97316',
      light: '#fb923c',
      dark: '#ea580c',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#9ca3af',
    },
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
  },
  shape: { borderRadius: 8 },
});
