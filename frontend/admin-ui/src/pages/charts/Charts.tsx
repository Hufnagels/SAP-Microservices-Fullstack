/*
 * pages/charts/Charts.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : Charts page showing a grouped bar chart (Monthly Sales & Revenue)
 *           and a donut/pie chart (Traffic Sources) side by side.
 *
 * Relationships
 *   Reads   : state.charts.{ barData, donutData }  (from chartsSlice)
 *   Library : recharts (BarChart, PieChart)
 *
 * Key local constant
 *   COLORS – orange palette applied to donut segments
 *            ['#f97316', '#fb923c', '#fdba74', '#fed7aa']
 */
import { useSelector } from 'react-redux';
import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie,
} from 'recharts';
import type { RootState } from '../../app/store';

const COLORS = ['#f97316', '#fb923c', '#fdba74', '#fed7aa'];

export default function Charts() {
  const barData   = useSelector((s: RootState) => s.charts.barData);
  const rawDonut  = useSelector((s: RootState) => s.charts.donutData);
  const donutData = rawDonut.map((d, i) => ({ ...d, fill: COLORS[i % COLORS.length] }));

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Charts
      </Typography>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Monthly Sales &amp; Revenue
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="sales"   fill="#f97316" radius={[4, 4, 0, 0]} />
                <Bar dataKey="revenue" fill="#fdba74" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" fontWeight={600} gutterBottom>
              Traffic Sources
            </Typography>
            <ResponsiveContainer width="100%" height={320}>
              <PieChart>
                <Pie
                  data={donutData}
                  innerRadius={75}
                  outerRadius={120}
                  dataKey="value"
                  paddingAngle={3}
                />
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
