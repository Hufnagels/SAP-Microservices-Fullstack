import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#d4e157',
      light: '#e6ee9c',
      dark: '#afb42b',
      contrastText: '#212121',
    },
    secondary: {
      main: '#ffab00',
      contrastText: '#212121',
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
      main: '#d4e157',
      light: '#e6ee9c',
      dark: '#afb42b',
      contrastText: '#212121',
    },
    secondary: {
      main: '#ffab00',
      contrastText: '#212121',
    },
    background: {
      default: '#0d1117',
      paper: '#161b22',
    },
  },
  shape: { borderRadius: 8 },
});
