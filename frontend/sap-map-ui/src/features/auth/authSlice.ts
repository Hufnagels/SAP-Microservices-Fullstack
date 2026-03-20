/*
 * features/auth/authSlice.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Redux slice for authentication — JWT token lifecycle, current
 *           user data, and profile updates.
 *
 * Used by : store.ts (registered as 'auth'), SignIn.tsx, UserAccount.tsx,
 *           all slices/pages that attach the Bearer token to API requests
 *
 * Key variables / exports
 *   User             – Interface: { id, name, email, role, avatar_base64?, avatar_mode? }
 *   AuthState        – { token, user, loading, error }; token seeded from localStorage
 *   signIn           – Thunk: POST /auth/login → stores token + user, persists to localStorage
 *   fetchCurrentUser – Thunk: GET  /users/me  → refreshes user object from backend
 *   updateProfile    – Thunk: PUT  /users/me  → updates name/email/avatar, syncs user state
 *   signOut          – Reducer: clears token + user, removes 'token' from localStorage
 *   setUser          – Reducer: directly overwrite user object in state
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import axios from 'axios';
import { VITE_APP_API_URL } from '../config';

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
      const response = await axios.post(`${VITE_APP_API_URL}/auth/login`, { username, password });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Login failed');
    }
  }
);

export const fetchCurrentUser = createAsyncThunk(
  'auth/fetchCurrentUser',
  async (_, { getState, rejectWithValue }) => {
    const state = getState() as { auth: AuthState };
    try {
      const response = await axios.get(`${VITE_APP_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${state.auth.token}` },
      });
      return response.data;
    } catch (err: any) {
      return rejectWithValue({
        status: err.response?.status,
        detail: err.response?.data?.detail || 'Failed to fetch user',
      });
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (
    data: {
      name?: string;
      email?: string;
      avatar_base64?: string | null;
      avatar_mode?: 'letter' | 'image';
    },
    { getState, rejectWithValue }
  ) => {
    const state = getState() as { auth: AuthState };
    try {
      const response = await axios.put(`${VITE_APP_API_URL}/auth/users/me`, data, {
        headers: { Authorization: `Bearer ${state.auth.token}` },
      });
      return response.data;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Update failed');
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
    setUser(state, action: PayloadAction<User>) {
      state.user = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(signIn.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signIn.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload.access_token;
        state.user = null; // populated by fetchCurrentUser dispatched after login
        localStorage.setItem('token', action.payload.access_token);
      })
      .addCase(signIn.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      })
      .addCase(fetchCurrentUser.fulfilled, (state, action) => {
        state.user = action.payload;
      })
      .addCase(fetchCurrentUser.rejected, (state, action) => {
        state.user = null;
        // Only sign out for 401 (expired/invalid token) — not for 500 or network errors
        const payload = action.payload as { status?: number } | undefined;
        if (payload?.status === 401) {
          state.token = null;
          localStorage.removeItem('token');
        }
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload;
      });
  },
});

export const { signOut, setUser } = authSlice.actions;
export default authSlice.reducer;
