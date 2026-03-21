import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

export interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  service_roles: Record<string, string>;
  avatar_base64?: string | null;
  avatar_mode?: 'letter' | 'image';
}

interface AuthState {
  token: string | null;
  user: User | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  token: localStorage.getItem('token'),
  user: null,
  loading: false,
  error: null,
};

export const signIn = createAsyncThunk(
  'auth/signIn',
  async ({ username, password }: { username: string; password: string }, { rejectWithValue }) => {
    try {
      const res = await axios.post('/auth/login', { username, password });
      return res.data as { access_token: string };
    } catch (err: any) {
      return rejectWithValue(err.response?.data ?? { detail: 'Login failed' });
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { auth: AuthState };
    try {
      const res = await axios.get('/auth/me', {
        headers: { Authorization: `Bearer ${state.auth.token}` },
      });
      return res.data as User;
    } catch (err: any) {
      return rejectWithValue({ status: err.response?.status });
    }
  }
);

export const renewToken = createAsyncThunk(
  'auth/renewToken',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { auth: AuthState };
    try {
      const response = await axios.post('/auth/refresh', {}, {
        headers: { Authorization: `Bearer ${state.auth.token}` },
      });
      return response.data as { access_token: string };
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Token renewal failed');
    }
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    signOut(state) {
      state.token = null;
      state.user = null;
      localStorage.removeItem('token');
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending,   (s) => { s.loading = true; s.error = null; })
      .addCase(signIn.fulfilled, (s, a) => {
        s.loading = false;
        s.token = a.payload.access_token;
        localStorage.setItem('token', a.payload.access_token);
      })
      .addCase(signIn.rejected, (s, a) => {
        s.loading = false;
        s.error = (a.payload as any)?.detail ?? 'Login failed';
      })
      .addCase(fetchCurrentUser.fulfilled, (s, a) => { s.user = a.payload; })
      .addCase(fetchCurrentUser.rejected,  (s, a) => {
        s.user = null;
        if ((a.payload as any)?.status === 401) {
          s.token = null;
          localStorage.removeItem('token');
        }
      })
      .addCase(renewToken.fulfilled, (s, a) => {
        s.token = a.payload.access_token;
        localStorage.setItem('token', a.payload.access_token);
      });
  },
});

export const { signOut } = authSlice.actions;
export default authSlice.reducer;
