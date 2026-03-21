import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import axios from 'axios';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { lightTheme, darkTheme } from './theme/muiTheme';
import { routes, flattenRoutes } from './routes/routes';
import MainLayout from './layout/MainLayout';
import { store } from './app/store';
import type { RootState, AppDispatch } from './app/store';
import { fetchCurrentUser, signOut } from './features/auth/authSlice';
import SessionGuard from './components/common/SessionGuard';

// Global 401 interceptor — expired / invalid token → auto sign-out
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      store.dispatch(signOut());
    }
    return Promise.reject(err);
  }
);

function ProtectedRoute() {
  const token = useSelector((state: RootState) => state.auth.token);
  return token ? <Outlet /> : <Navigate to="/login" replace />;
}

export default function App() {
  const dispatch = useDispatch<AppDispatch>();
  const { mode } = useSelector((state: RootState) => state.theme);
  const { token } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', mode === 'dark');
  }, [mode]);

  useEffect(() => {
    if (token) dispatch(fetchCurrentUser());
  }, [token, dispatch]);

  const muiTheme = mode === 'dark' ? darkTheme : lightTheme;

  const flat             = flattenRoutes(routes);
  const publicRoutes     = flat.filter((r) => !r.protected);
  const protectedRoutes  = flat.filter((r) => r.protected);

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {publicRoutes.map((route) => (
            <Route key={route.path} path={route.path} element={<route.element />} />
          ))}

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<Navigate to="/status" replace />} />
              {protectedRoutes.map((route) => (
                <Route key={route.path} path={route.path} element={<route.element />} />
              ))}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      {token && <SessionGuard />}
      <ToastContainer position="bottom-right" autoClose={4000} />
    </ThemeProvider>
  );
}
