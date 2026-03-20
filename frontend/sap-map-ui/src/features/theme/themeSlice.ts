/*
 * features/theme/themeSlice.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Redux slice that tracks and persists the UI colour-mode
 *           (light orange / dark).
 *
 * Used by : store.ts (registered as 'theme'), App.tsx theme provider,
 *           header toggle button
 *
 * Key variables / exports
 *   ThemeMode   – 'light' | 'dark'
 *   ThemeState  – { mode: ThemeMode }; seeded from localStorage key 'themeMode'
 *   toggleTheme – Reducer: flips mode and writes to localStorage
 *   setTheme    – Reducer: sets an explicit mode and writes to localStorage
 */
import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

type ThemeMode = 'light' | 'dark';

interface ThemeState {
  mode: ThemeMode;
}

const initialState: ThemeState = {
  mode: (localStorage.getItem('themeMode') as ThemeMode) || 'light',
};

const themeSlice = createSlice({
  name: 'theme',
  initialState,
  reducers: {
    toggleTheme(state) {
      state.mode = state.mode === 'light' ? 'dark' : 'light';
      localStorage.setItem('themeMode', state.mode);
    },
    setTheme(state, action: PayloadAction<ThemeMode>) {
      state.mode = action.payload;
      localStorage.setItem('themeMode', action.payload);
    },
  },
});

export const { toggleTheme, setTheme } = themeSlice.actions;
export default themeSlice.reducer;
