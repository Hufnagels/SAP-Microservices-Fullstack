import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { sapApi } from '../../api/client';

export interface QueryDef {
  query_id: number;
  query_name: string;
  base_table: string;
  description: string | null;
  sql_original: string | null;
  sql_b1_comp_base_query: string | null;
  sql_b1_comp_extra_options: string | null;
  service_name: string | null;
  is_active: boolean;
  created_at: string;
}

interface QueryDefIn {
  query_name: string;
  dst_table?: string;
  description?: string;
  sql_original: string;
  service_name?: string | null;
}

interface QueriesState {
  items: QueryDef[];
  loading: boolean;
}

const initialState: QueriesState = { items: [], loading: false };

export const fetchQueries = createAsyncThunk('queries/fetchAll', async () => {
  const res = await sapApi.get<QueryDef[]>('/queries');
  return res.data;
});

export const createQuery = createAsyncThunk('queries/create', async (body: QueryDefIn) => {
  const res = await sapApi.post('/queries', body);
  return res.data;
});

export const updateQuery = createAsyncThunk(
  'queries/update',
  async ({ id, body }: { id: number; body: QueryDefIn }) => {
    const res = await sapApi.put(`/queries/${id}`, body);
    return res.data;
  },
);

export const deleteQuery = createAsyncThunk('queries/delete', async (id: number) => {
  await sapApi.delete(`/queries/${id}`);
  return id;
});

const queriesSlice = createSlice({
  name: 'queries',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchQueries.pending, (s) => { s.loading = true; })
      .addCase(fetchQueries.fulfilled, (s, a) => { s.loading = false; s.items = a.payload; })
      .addCase(fetchQueries.rejected, (s) => { s.loading = false; })
      .addCase(deleteQuery.fulfilled, (s, a) => {
        s.items = s.items.filter((q) => q.query_id !== a.payload);
      });
  },
});

export default queriesSlice.reducer;
