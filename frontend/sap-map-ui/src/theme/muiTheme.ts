import { createTheme } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';

export const lightTheme: Theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#50aaba',
      light: '#50aaba',
      dark: '#50aaba',
      contrastText: '#212121',
    },
    secondary: {
      main: '#ffab00',
      contrastText: '#212121',
    },
    background: {
      default: '#ffffff',
      paper: '#fafafa',
    },
  },
  shape: { borderRadius: 8 },
});

export const darkTheme: Theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#0ab5af',
      light: '#08e0d9',
      dark: '#078682',
      contrastText: '#ffffff',
    },
    secondary: {
      main: '#3e3e3e',
      contrastText: '#f3f3f3',
    },
    background: {
      default: '#414141',
      paper: '#313131',
    },
  },
  shape: { borderRadius: 8 },
});
