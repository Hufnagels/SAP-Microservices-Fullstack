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
import MainLayout from './components/layout/MainLayout';
import { store } from './app/store';
import type { RootState, AppDispatch } from './app/store';
import { fetchCurrentUser, signOut } from './features/auth/authSlice';

// Global 401 → auto sign-out
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) store.dispatch(signOut());
    return Promise.reject(err);
  }
);

function ProtectedRoute() {
  const token = useSelector((s: RootState) => s.auth.token);
  return token ? <Outlet /> : <Navigate to="/signin" replace />;
}

export default function App() {
  const dispatch   = useDispatch<AppDispatch>();
  const { mode }   = useSelector((s: RootState) => s.theme);
  const { token }  = useSelector((s: RootState) => s.auth);

  useEffect(() => {
    if (token) dispatch(fetchCurrentUser());
  }, [token, dispatch]);

  const flat            = flattenRoutes(routes);
  const publicRoutes    = flat.filter((r) => !r.protected);
  const protectedRoutes = flat.filter((r) => r.protected);

  return (
    <ThemeProvider theme={mode === 'dark' ? darkTheme : lightTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          {publicRoutes.map((r) => (
            <Route key={r.path} path={r.path} element={<r.element />} />
          ))}

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              {protectedRoutes.map((r) => (
                <Route key={r.path} path={r.path} element={<r.element />} />
              ))}
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <ToastContainer position="bottom-right" autoClose={4000} />
    </ThemeProvider>
  );
}
