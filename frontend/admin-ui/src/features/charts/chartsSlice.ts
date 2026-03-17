/*
 * features/charts/chartsSlice.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Redux slice that holds static mock data for the Charts page.
 *           No async thunks — all data is baked in as initialState.
 *
 * Used by : store.ts (registered as 'charts'), Charts.tsx
 *
 * Key variables / exports
 *   BarDataPoint   – { month, sales, revenue }; 7 months of mock data
 *   DonutDataPoint – { name, value }; 4 traffic-source segments
 *   ChartsState    – { barData: BarDataPoint[], donutData: DonutDataPoint[] }
 */
import { createSlice } from '@reduxjs/toolkit';

export interface BarDataPoint {
  month: string;
  sales: number;
  revenue: number;
}

export interface DonutDataPoint {
  name: string;
  value: number;
}

interface ChartsState {
  barData: BarDataPoint[];
  donutData: DonutDataPoint[];
}

const initialState: ChartsState = {
  barData: [
    { month: 'Jan', sales: 400, revenue: 240 },
    { month: 'Feb', sales: 300, revenue: 139 },
    { month: 'Mar', sales: 600, revenue: 380 },
    { month: 'Apr', sales: 800, revenue: 430 },
    { month: 'May', sales: 500, revenue: 280 },
    { month: 'Jun', sales: 900, revenue: 520 },
    { month: 'Jul', sales: 750, revenue: 460 },
  ],
  donutData: [
    { name: 'Direct',   value: 400 },
    { name: 'Organic',  value: 300 },
    { name: 'Referral', value: 200 },
    { name: 'Social',   value: 100 },
  ],
};

const chartsSlice = createSlice({
  name: 'charts',
  initialState,
  reducers: {},
});

export default chartsSlice.reducer;
