import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';
import { lightTheme, darkTheme } from './theme/muiTheme';
import MainLayout from './layout/MainLayout';
import SignIn from './pages/SignIn';
import LabelDesignerPage from './pages/designer/LabelDesignerPage';
import { store } from './app/store';
import type { RootState, AppDispatch } from './app/store';
import { fetchCurrentUser, signOut } from './features/auth/authSlice';
import SessionGuard from './components/common/SessionGuard';

// Auto sign-out on 401
axios.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) store.dispatch(signOut());
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

  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<SignIn />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
              <Route index element={<Navigate to="/designer" replace />} />
              <Route path="/designer" element={<LabelDesignerPage />} />
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/designer" replace />} />
        </Routes>
      </BrowserRouter>
      {token && <SessionGuard />}
      <ToastContainer position="bottom-right" autoClose={4000} />
    </ThemeProvider>
  );
}
