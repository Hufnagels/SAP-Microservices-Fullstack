import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#4bb1a8',
      light: '#39d6c9',
      dark: '#33847d',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#6b7280',
    },
    background: {
      default: '#fafaf9',
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
      default: '#080b12',
      paper: '#131720',
    },
  },
  shape: { borderRadius: 8 },
});
