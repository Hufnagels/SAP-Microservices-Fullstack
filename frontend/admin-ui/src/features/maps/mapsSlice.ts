/*
 * features/maps/mapsSlice.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Redux slice for all three map pages — history markers, GeoJSON
 *           country data, custom preset locations, and user-drawn shapes.
 *           Serialisable state only; Leaflet layer objects live in local
 *           component state (CustomMap.tsx).
 *
 * Used by : store.ts (registered as 'maps'), HistoryMap.tsx,
 *           GeoJsonMap.tsx, CustomMap.tsx
 * Backend : GET/POST/PUT/DELETE http://localhost:8000/maps/*
 *
 * Key types
 *   HistoryMarker  – financial centre: { id, name, lat, lng, value, change }
 *   CustomMapItem  – preset location:  { id, name, lat, lng, type, description, boundsNE?, boundsSW? }
 *   StoredShape    – saved drawn shape: { id, name, type, description?, lat?, lng?,
 *                    radius?, boundsNE?, boundsSW?, latlngs? }
 *
 * Thunks (async)
 *   fetchHistoryMarkers – GET    /maps/history
 *   fetchGeoJson        – GET    /maps/geojson
 *   fetchCustomMap      – GET    /maps/custom
 *   addPreset           – POST   /maps/custom
 *   updatePreset        – PUT    /maps/custom/:id
 *   deletePreset        – DELETE /maps/custom/:id
 *   saveShapes          – POST   /maps/shapes  (appends drawn shapes to backend)
 *   fetchShapes         – GET    /maps/shapes
 *   updateSavedShape    – PUT    /maps/shapes/:id
 *   deleteSavedShape    – DELETE /maps/shapes/:id
 *
 * Synchronous reducers
 *   addDrawnShape / updateDrawnShape / removeDrawnShape / clearDrawnShapes
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { FeatureCollection } from 'geojson';
import axios from 'axios';
import { VITE_APP_API_URL } from '../config';

export interface HistoryMarker {
  id: number;
  name: string;
  lat: number;
  lng: number;
  value: number;
  change: number;
}

export interface CustomMapItem {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type: string;
  description: string;
  boundsNE?: [number, number];
  boundsSW?: [number, number];
}

export interface StoredShape {
  id: number;
  name: string;
  type: string;
  description?: string;
  lat?: number;
  lng?: number;
  radius?: number;
  boundsNE?: [number, number];
  boundsSW?: [number, number];
  latlngs?: [number, number][];
}

interface MapsState {
  markers: HistoryMarker[];
  geoData: FeatureCollection | null;
  customItems: CustomMapItem[];
  drawnShapes: StoredShape[];
  savedShapes: StoredShape[];
  markersLoading: boolean;
  geoLoading: boolean;
  customLoading: boolean;
  shapesSaving: boolean;
  shapesLoading: boolean;
  error: string | null;
}

const initialState: MapsState = {
  markers: [],
  geoData: null,
  customItems: [],
  drawnShapes: [],
  savedShapes: [],
  markersLoading: false,
  geoLoading: false,
  customLoading: false,
  shapesSaving: false,
  shapesLoading: false,
  error: null,
};

// ── Auth helper ───────────────────────────────────────────────────────────────
type AuthState = { auth: { token: string | null } };
const hdrs = (token: string | null) => ({ Authorization: `Bearer ${token}` });
const BASE = `${VITE_APP_API_URL}/maps`;

// ── Thunks ────────────────────────────────────────────────────────────────────
export const fetchHistoryMarkers = createAsyncThunk(
  'maps/fetchHistoryMarkers',
  async (_, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.get(`${BASE}/history`, { headers: hdrs(auth.token) });
      return res.data as HistoryMarker[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to load history markers');
    }
  }
);

export const fetchGeoJson = createAsyncThunk(
  'maps/fetchGeoJson',
  async (_, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.get(`${BASE}/geojson`, { headers: hdrs(auth.token) });
      return res.data as FeatureCollection;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to load GeoJSON data');
    }
  }
);

// ── Preset locations CRUD ─────────────────────────────────────────────────────
export const fetchCustomMap = createAsyncThunk(
  'maps/fetchCustomMap',
  async (_, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.get(`${BASE}/custom`, { headers: hdrs(auth.token) });
      return res.data as CustomMapItem[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to load custom map data');
    }
  }
);

export const addPreset = createAsyncThunk(
  'maps/addPreset',
  async (item: Omit<CustomMapItem, 'id'>, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.post(`${BASE}/custom`, item, { headers: hdrs(auth.token) });
      return res.data as CustomMapItem;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to add preset');
    }
  }
);

export const updatePreset = createAsyncThunk(
  'maps/updatePreset',
  async (item: CustomMapItem, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.put(`${BASE}/custom/${item.id}`, item, { headers: hdrs(auth.token) });
      return res.data as CustomMapItem;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to update preset');
    }
  }
);

export const deletePreset = createAsyncThunk(
  'maps/deletePreset',
  async (id: number, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      await axios.delete(`${BASE}/custom/${id}`, { headers: hdrs(auth.token) });
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to delete preset');
    }
  }
);

// ── Saved shapes CRUD ─────────────────────────────────────────────────────────
export const saveShapes = createAsyncThunk(
  'maps/saveShapes',
  async (shapes: StoredShape[], { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.post(`${BASE}/shapes`, shapes, { headers: hdrs(auth.token) });
      return res.data as StoredShape[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to save shapes');
    }
  }
);

export const fetchShapes = createAsyncThunk(
  'maps/fetchShapes',
  async (_, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.get(`${BASE}/shapes`, { headers: hdrs(auth.token) });
      return res.data as StoredShape[];
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to load saved shapes');
    }
  }
);

export const updateSavedShape = createAsyncThunk(
  'maps/updateSavedShape',
  async (shape: StoredShape, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      const res = await axios.put(`${BASE}/shapes/${shape.id}`, shape, { headers: hdrs(auth.token) });
      return res.data as StoredShape;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to update shape');
    }
  }
);

export const deleteSavedShape = createAsyncThunk(
  'maps/deleteSavedShape',
  async (id: number, { getState, rejectWithValue }) => {
    const { auth } = getState() as AuthState;
    try {
      await axios.delete(`${BASE}/shapes/${id}`, { headers: hdrs(auth.token) });
      return id;
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail ?? 'Failed to delete shape');
    }
  }
);

// ── Slice ─────────────────────────────────────────────────────────────────────
const mapsSlice = createSlice({
  name: 'maps',
  initialState,
  reducers: {
    addDrawnShape: (state, action: PayloadAction<StoredShape>) => {
      state.drawnShapes.push(action.payload);
    },
    updateDrawnShape: (state, action: PayloadAction<Partial<StoredShape> & { id: number }>) => {
      const i = state.drawnShapes.findIndex((s) => s.id === action.payload.id);
      if (i >= 0) state.drawnShapes[i] = { ...state.drawnShapes[i], ...action.payload };
    },
    removeDrawnShape: (state, action: PayloadAction<number>) => {
      state.drawnShapes = state.drawnShapes.filter((s) => s.id !== action.payload);
    },
    clearDrawnShapes: (state) => {
      state.drawnShapes = [];
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchHistoryMarkers.pending,   (s) => { s.markersLoading = true;  s.error = null; })
      .addCase(fetchHistoryMarkers.fulfilled, (s, a) => { s.markersLoading = false; s.markers = a.payload; })
      .addCase(fetchHistoryMarkers.rejected,  (s, a) => { s.markersLoading = false; s.error = a.payload as string; })

      .addCase(fetchGeoJson.pending,   (s) => { s.geoLoading = true;  s.error = null; })
      .addCase(fetchGeoJson.fulfilled, (s, a) => { s.geoLoading = false; s.geoData = a.payload; })
      .addCase(fetchGeoJson.rejected,  (s, a) => { s.geoLoading = false; s.error = a.payload as string; })

      // Preset CRUD
      .addCase(fetchCustomMap.pending,   (s) => { s.customLoading = true;  s.error = null; })
      .addCase(fetchCustomMap.fulfilled, (s, a) => { s.customLoading = false; s.customItems = a.payload; })
      .addCase(fetchCustomMap.rejected,  (s, a) => { s.customLoading = false; s.error = a.payload as string; })
      .addCase(addPreset.fulfilled,    (s, a) => { s.customItems.push(a.payload); })
      .addCase(updatePreset.fulfilled, (s, a) => {
        const i = s.customItems.findIndex((c) => c.id === a.payload.id);
        if (i >= 0) s.customItems[i] = a.payload;
      })
      .addCase(deletePreset.fulfilled, (s, a) => {
        s.customItems = s.customItems.filter((c) => c.id !== a.payload);
      })

      // Saved shapes CRUD
      .addCase(saveShapes.pending,   (s) => { s.shapesSaving = true;  s.error = null; })
      .addCase(saveShapes.fulfilled, (s, a) => { s.shapesSaving = false; s.savedShapes = a.payload; })
      .addCase(saveShapes.rejected,  (s, a) => { s.shapesSaving = false; s.error = a.payload as string; })
      .addCase(fetchShapes.pending,   (s) => { s.shapesLoading = true;  s.error = null; })
      .addCase(fetchShapes.fulfilled, (s, a) => { s.shapesLoading = false; s.savedShapes = a.payload; })
      .addCase(fetchShapes.rejected,  (s, a) => { s.shapesLoading = false; s.error = a.payload as string; })
      .addCase(updateSavedShape.fulfilled, (s, a) => {
        const i = s.savedShapes.findIndex((sh) => sh.id === a.payload.id);
        if (i >= 0) s.savedShapes[i] = a.payload;
      })
      .addCase(deleteSavedShape.fulfilled, (s, a) => {
        s.savedShapes = s.savedShapes.filter((sh) => sh.id !== a.payload);
      });
  },
});

export const { addDrawnShape, updateDrawnShape, removeDrawnShape, clearDrawnShapes } = mapsSlice.actions;
export default mapsSlice.reducer;
