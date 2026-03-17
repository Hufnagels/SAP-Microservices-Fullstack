/*
 * features/permissions/permissionsSlice.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Redux slice for role permissions map — GET/PUT against
 *           /auth/permissions.
 *
 * Shape   : { [role: string]: { [resource: string]: string[] } }
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { VITE_APP_API_URL } from '../config';

export type PermissionsMap = Record<string, Record<string, string[]>>;

interface PermissionsState {
  data: PermissionsMap;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: PermissionsState = {
  data: {},
  loading: false,
  saving: false,
  error: null,
};

type AuthState = { auth: { token: string | null } };
const hdrs = (token: string | null) => ({ Authorization: `Bearer ${token}` });
const BASE = `${VITE_APP_API_URL}/auth/permissions`;

export const fetchPermissions = createAsyncThunk(
  'permissions/fetch',
  async (_, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.get(BASE, { headers: hdrs(auth.token) });
      return res.data as PermissionsMap;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to load permissions');
    }
  }
);

export const savePermissions = createAsyncThunk(
  'permissions/save',
  async (perms: PermissionsMap, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.put(BASE, perms, { headers: hdrs(auth.token) });
      return res.data as PermissionsMap;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to save permissions');
    }
  }
);

const permissionsSlice = createSlice({
  name: 'permissions',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPermissions.pending,   (s) => { s.loading = true;  s.error = null; })
      .addCase(fetchPermissions.fulfilled, (s, a) => { s.loading = false; s.data = a.payload; })
      .addCase(fetchPermissions.rejected,  (s, a) => { s.loading = false; s.error = a.payload as string; })

      .addCase(savePermissions.pending,    (s) => { s.saving = true;  s.error = null; })
      .addCase(savePermissions.fulfilled,  (s, a) => { s.saving = false; s.data = a.payload; })
      .addCase(savePermissions.rejected,   (s, a) => { s.saving = false; s.error = a.payload as string; });
  },
});

export default permissionsSlice.reducer;
