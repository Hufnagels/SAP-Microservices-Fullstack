import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

// Light: default MUI blue
export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary:    { main: '#1976d2' },
    secondary:  { main: '#dc004e' },
    background: { default: '#f5f5f5', paper: '#ffffff' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar:  { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDrawer:  { styleOverrides: { paper: { backgroundImage: 'none' } } },
  },
});

// Dark: slate-navy with teal accent
export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary:    { main: '#29b6f6' },   // light blue 400
    secondary:  { main: '#80cbc4' },   // teal 200
    background: { default: '#0d1b2a', paper: '#1a2942' },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiAppBar:  { styleOverrides: { root: { backgroundImage: 'none' } } },
    MuiDrawer:  { styleOverrides: { paper: { backgroundImage: 'none' } } },
  },
});
