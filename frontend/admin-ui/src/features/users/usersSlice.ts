/*
 * features/users/usersSlice.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Redux slice for the User Table — full CRUD against the backend
 *           /users REST endpoints.
 *
 * Used by : store.ts (registered as 'users'), Table.tsx
 * Backend : GET/POST/PUT/DELETE http://localhost:8000/users/*
 *
 * Key variables / exports
 *   UserRow    – { id, name, email, role, status, joined,
 *                  avatar_mode?: 'letter'|'image', avatar_base64?: string|null }
 *   UsersState – { list: UserRow[], loading, saving, error }
 *   fetchUsers  – Thunk: GET    /users/   → populates list
 *   createUser  – Thunk: POST   /users/   → appends to list
 *   updateUser  – Thunk: PUT    /users/:id → replaces item in list
 *   deleteUser  – Thunk: DELETE /users/:id → filters item from list
 *   (all thunks attach Bearer token from auth slice via AuthState helper)
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { VITE_APP_API_URL } from '../config';

export interface UserRow {
  id: number;
  username: string;
  name: string;
  email: string;
  role: string;
  service_roles: Record<string, string>;
  status: string;
  joined: string;
  avatar_mode?: 'letter' | 'image';
  avatar_base64?: string | null;
}

interface UsersState {
  list: UserRow[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: UsersState = {
  list: [],
  loading: false,
  saving: false,
  error: null,
};

type AuthState = { auth: { token: string | null } };
const hdrs = (token: string | null) => ({ Authorization: `Bearer ${token}` });
const BASE = `${VITE_APP_API_URL}/auth/users`;

export const fetchUsers = createAsyncThunk(
  'users/fetchUsers',
  async (_, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.get(BASE, { headers: hdrs(auth.token) });
      return res.data as UserRow[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to load users');
    }
  }
);

export const createUser = createAsyncThunk(
  'users/createUser',
  async (user: Omit<UserRow, 'id'> & { password?: string }, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.post(BASE, user, { headers: hdrs(auth.token) });
      return res.data as UserRow;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to create user');
    }
  }
);

export const updateUser = createAsyncThunk(
  'users/updateUser',
  async (user: UserRow & { password?: string }, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.put(`${BASE}/${user.id}`, user, { headers: hdrs(auth.token) });
      return res.data as UserRow;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to update user');
    }
  }
);

export const deleteUser = createAsyncThunk(
  'users/deleteUser',
  async (id: number, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      await axios.delete(`${BASE}/${id}`, { headers: hdrs(auth.token) });
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to delete user');
    }
  }
);

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending,   (s) => { s.loading = true;  s.error = null; })
      .addCase(fetchUsers.fulfilled, (s, a) => { s.loading = false; s.list = a.payload; })
      .addCase(fetchUsers.rejected,  (s, a) => { s.loading = false; s.error = a.payload as string; })

      .addCase(createUser.pending,   (s) => { s.saving = true;  s.error = null; })
      .addCase(createUser.fulfilled, (s, a) => { s.saving = false; s.list.push(a.payload); })
      .addCase(createUser.rejected,  (s, a) => { s.saving = false; s.error = a.payload as string; })

      .addCase(updateUser.pending,   (s) => { s.saving = true;  s.error = null; })
      .addCase(updateUser.fulfilled, (s, a) => {
        s.saving = false;
        const i = s.list.findIndex((u) => u.id === a.payload.id);
        if (i >= 0) s.list[i] = a.payload;
      })
      .addCase(updateUser.rejected,  (s, a) => { s.saving = false; s.error = a.payload as string; })

      .addCase(deleteUser.pending,   (s) => { s.saving = true;  s.error = null; })
      .addCase(deleteUser.fulfilled, (s, a) => { s.saving = false; s.list = s.list.filter((u) => u.id !== a.payload); })
      .addCase(deleteUser.rejected,  (s, a) => { s.saving = false; s.error = a.payload as string; });
  },
});

export default usersSlice.reducer;
