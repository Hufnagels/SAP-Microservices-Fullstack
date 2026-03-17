# Frontend demo

This is a minimal Vite + React demo using `@react-three/fiber` to visualize layer positions returned from the backend.

## Setup

```bash
cd binpack/frontend
npm install
npm run dev
```

The frontend uses a Vite proxy (configured in `vite.config.js`) so API requests to `/optimize-layer`, `/package`, etc. are forwarded to `http://127.0.0.1:8000` by default. Adjust or remove the proxy if you run the backend on a different host/port.

## Features

- **Cylinder inputs** – at the top of the (now fixed) control panel enter roll diameter (mm), height (mm) and weight (kg). These values are sent to the backend when reloading the layer and are available for later layer/stacking and weight‑aware grouping.

- **Responsive canvas** – the 3‑D viewport automatically resizes when its container changes size using a built‑in `ResizeObserver` polyfill supplied to the `<Canvas>` component. No manual observers are required.

- **Pizza‑packing controls** – choose hexagonal or square packing and a pack size for grouping.

- **View modes** – toggle between colored package display and plain layer visualization. Click a package in the list to highlight its rolls.

- **Interactive 3D** – the right‑hand viewport shows the current layer using `@react-three/fiber`; changes reload automatically when the layer is refreshed.  A white wireframe rectangle outlines the 800 × 1200 mm pallet so you can see the boundary at all times.

## Notes

This demo is intentionally small to keep focus on algorithm prototyping; feel free to expand it into a multi‑page flow with routing, persistence, or additional configuration panels.
