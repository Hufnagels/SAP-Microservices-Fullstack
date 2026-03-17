/*
 * pages/charts/RidgelineChart.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Purpose : D3.js ridgeline (joy plot) chart that visualises six monthly value
 *           distributions using kernel density estimation. Re-renders on
 *           theme change to pick up the correct text / divider colours.
 *
 * Relationships
 *   No Redux state — data is generated locally with random normal sampling.
 *   Library : d3  (scales, area/line generators, KDE, axis)
 *   Uses    : MUI useTheme() for text/divider colours
 *
 * Key local functions / constants
 *   randomNormal(mean, std)      – Box-Muller transform RNG
 *   kernelDensityEstimator(k, X) – returns a function that maps values → [x, density] pairs
 *   kernelEpanechnikov(k)        – Epanechnikov kernel (bandwidth k)
 *   sampleData                   – 6 × 300 pre-generated random values (stable across renders)
 *   svgRef                       – ref to the <svg> element; D3 draws into it imperatively
 */
import { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { useTheme } from '@mui/material/styles';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

// Box-Muller random normal
function randomNormal(mean: number, std: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  return mean + std * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const categories = ['January', 'February', 'March', 'April', 'May', 'June'];

// Generate sample data once (stable across renders)
const sampleData = categories.map((cat, i) => ({
  key: cat,
  values: Array.from({ length: 300 }, () => randomNormal(20 + i * 8, 12 + i * 1.5)),
}));

function kernelDensityEstimator(kernel: (v: number) => number, X: number[]) {
  return (V: number[]) =>
    X.map((x) => [x, d3.mean(V, (v) => kernel(x - v)) ?? 0] as [number, number]);
}

function kernelEpanechnikov(k: number) {
  return (v: number) => (Math.abs((v /= k)) <= 1 ? (0.75 * (1 - v * v)) / k : 0);
}

export default function RidgelineChart() {
  const svgRef = useRef<SVGSVGElement>(null);
  const theme = useTheme();

  useEffect(() => {
    if (!svgRef.current) return;

    const bandH = 60;
    const overlap = 2.8;
    // top margin must accommodate the first ridge's peak, which rises
    // bandH * overlap above its baseline (at y = bandH inside the g group).
    // Peak sits at bandH - bandH*overlap = bandH*(1-overlap) below the g origin,
    // so we need at least bandH*(overlap-1) + padding.
    const margin = {
      top: Math.ceil(bandH * (overlap - 1)) + 20,
      right: 30,
      bottom: 40,
      left: 110,
    };
    const totalWidth = svgRef.current.clientWidth;
    const width = totalWidth - margin.left - margin.right;
    const height = bandH * categories.length ; // add some gap between ridgelines

    d3.select(svgRef.current).selectAll('*').remove();

    const svg = d3
      .select(svgRef.current)
      .attr('height', height + margin.top + margin.bottom )
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const allValues = sampleData.flatMap((d) => d.values);
    const xExtent = d3.extent(allValues) as [number, number];
    const x = d3.scaleLinear().domain(xExtent).range([0, width]).nice();
    const y = d3.scaleBand().domain(categories).range([0, height]).paddingInner(0);

    const kde = kernelDensityEstimator(kernelEpanechnikov(7), x.ticks(80));
    const densities = sampleData.map((d) => ({ key: d.key, density: kde(d.values) }));
    const maxDensity = d3.max(densities, (d) => d3.max(d.density, (p) => p[1])) ?? 1;

    const colorScale = d3
      .scaleSequential()
      .domain([0, categories.length - 1])
      .interpolator(d3.interpolateOranges);

    const textColor = theme.palette.text.secondary;
    const lineColor = theme.palette.divider;

    densities.forEach((d, i) => {
      const yBase = (y(d.key) ?? 0) + bandH;
      const densityY = d3.scaleLinear().domain([0, maxDensity]).range([0, bandH * overlap]);

      const area = d3
        .area<[number, number]>()
        .x((p) => x(p[0]))
        .y0(0)
        .y1((p) => -densityY(p[1]))
        .curve(d3.curveBasis);

      const line = d3
        .line<[number, number]>()
        .x((p) => x(p[0]))
        .y((p) => -densityY(p[1]))
        .curve(d3.curveBasis);

      const g = svg.append('g').attr('transform', `translate(0,${yBase})`);

      g.append('path')
        .datum(d.density)
        .attr('fill', colorScale(i))
        .attr('fill-opacity', 0.75)
        .attr('d', area);

      g.append('path')
        .datum(d.density)
        .attr('fill', 'none')
        .attr('stroke', colorScale(i))
        .attr('stroke-width', 1.5)
        .attr('d', line);

      // baseline
      g.append('line')
        .attr('x1', 0).attr('x2', width)
        .attr('y1', 0).attr('y2', 0)
        .attr('stroke', lineColor)
        .attr('stroke-width', 0.5);
    });

    // X axis
    svg
      .append('g')
      .attr('transform', `translate(0,${height})`)
      .call(d3.axisBottom(x).ticks(6))
      .call((g) => g.select('.domain').attr('stroke', lineColor))
      .call((g) => g.selectAll('text').attr('fill', textColor));

    // Y axis (category labels)
    svg
      .append('g')
      .call(d3.axisLeft(y).tickSize(0).tickPadding(10))
      .call((g) => g.select('.domain').remove())
      .call((g) => g.selectAll('text').attr('fill', textColor));

    // X label
    svg
      .append('text')
      .attr('x', width / 2)
      .attr('y', height + 35)
      .attr('text-anchor', 'middle')
      .attr('fill', textColor)
      .attr('font-size', 12)
      .text('Value');
  }, [theme.palette.mode]);

  return (
    <Box>
      <Typography variant="h4" fontWeight={700} gutterBottom>
        Ridgeline Chart
      </Typography>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={600} gutterBottom>
          Monthly Value Distributions (D3.js)
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Kernel density estimation showing how values are distributed across each month.
        </Typography>
        <Box sx={{ width: '100%', overflowX: 'auto' }}>
          <svg ref={svgRef} style={{ width: '100%', display: 'block' }} />
        </Box>
      </Paper>
    </Box>
  );
}
