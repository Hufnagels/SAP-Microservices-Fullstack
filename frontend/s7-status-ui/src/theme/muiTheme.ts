import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

// Industrial dark: deep navy + cyan accent
export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary:   { main: '#00bcd4' },   // cyan — industrial feel
    secondary: { main: '#ff7043' },   // deep orange — alarm color
    success:   { main: '#66bb6a' },
    warning:   { main: '#ffa726' },
    error:     { main: '#ef5350' },
    background: { default: '#0a0f1a', paper: '#111827' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar:  { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDrawer:  { styleOverrides: { paper: { backgroundImage: 'none' } } },
  },
});

export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#482880' },
    secondary: { main: '#8561c5' },
    success:   { main: '#388e3c' },
    warning:   { main: '#f57c00' },
    error:     { main: '#d32f2f' },
    background: { default: '#eceff1', paper: '#ffffff' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar:  { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDrawer:  { styleOverrides: { paper: { backgroundImage: 'none' } } },
  },
});
