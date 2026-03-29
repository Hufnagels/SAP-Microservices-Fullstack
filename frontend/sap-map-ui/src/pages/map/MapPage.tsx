import { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';
import axios from 'axios';
import { toast } from 'react-toastify';
import { useSelector } from 'react-redux';
import { Loader2 } from 'lucide-react';
import type { RootState } from '../../app/store';

interface Partner {
  id: number;
  card_code: string;
  name: string;
  address: string;
  sales: number;
  lat: number;
  lon: number;
}

export default function MapPage() {
  const token = useSelector((state: RootState) => state.auth.token);
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading]   = useState<boolean>(true);
  const [error, setError]       = useState<string | null>(null);
  const mapRef         = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef     = useRef<L.MarkerClusterGroup | null>(null);

  const getMarkerColor = (sales: number): string => {
    if (sales >= 150000000) return 'green';
    if (sales >= 100000000) return 'red';
    if (sales >= 50000000)  return 'violet';
    return 'blue';
  };

  const createColoredMarker = (lat: number, lon: number, color: string): L.Marker => {
    const markerColors: Record<string, string> = {
      red: '#faa686', green: '#7def9a', violet: '#ff9bd1', blue: '#9bceff',
    };
    const colorHex = markerColors[color] || '#dfdfdf';
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 75" width="45px" height="75px">
        <path d="M 37.692 49.306 C 27.541 80.123 17.389 80.123 7.238 49.306 C -2.913 18.489 2.162 3.081 22.465 3.081 C 42.768 3.081 47.843 18.489 37.692 49.306 Z M 22.465 9.329 C 15.907 9.329 10.591 14.285 10.591 20.398 C 10.591 26.511 15.907 31.466 22.465 31.466 C 29.023 31.466 34.339 26.511 34.339 20.398 C 34.339 14.285 29.023 9.329 22.465 9.329 Z"
          style="fill: ${colorHex}; stroke: #424242; stroke-width: 3px;"/>
      </svg>`;
    const customIcon = L.icon({
      iconUrl:    `data:image/svg+xml;base64,${btoa(svgIcon)}`,
      iconSize:   [36, 65],
      iconAnchor: [16, 65],
      popupAnchor:[2, -15],
    });
    return L.marker([lat, lon], { icon: customIcon });
  };

  useEffect(() => {
    let isMounted = true;
    const fetchPartners = async () => {
      try {
        setLoading(true);
        const { data } = await axios.get<Partner[]>('/maps/partners', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (isMounted) { setPartners(data); setLoading(false); }
      } catch (err) {
        if (isMounted) {
          const msg = err instanceof Error ? err.message : 'Failed to load map data';
          setError(msg);
          toast.error(msg);
          setLoading(false);
        }
      }
    };
    fetchPartners();
    return () => { isMounted = false; };
  }, [token]);

  useEffect(() => {
    if (!loading && partners.length > 0 && mapRef.current) {
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current).setView([47.49801, 19.03991], 6);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19,
        }).addTo(map);
        mapInstanceRef.current = map;
        setTimeout(() => map.invalidateSize(), 100);
      }
      const map = mapInstanceRef.current;
      if (markersRef.current) map.removeLayer(markersRef.current);
      const markers = L.markerClusterGroup();
      partners.forEach((p) => {
        const color  = getMarkerColor(p.sales);
        const marker = createColoredMarker(p.lat, p.lon, color);
        marker.bindPopup(`
          <div style="padding:8px;">
            <h3 style="font-weight:bold;font-size:1.1rem;margin-bottom:0.5rem;">${p.name}</h3>
            <p style="font-size:0.875rem;color:#4b5563;margin-bottom:0.25rem;">${p.address}</p>
            <p style="color:#059669;font-weight:600;">Sales: ${p.sales.toLocaleString('hu-HU', { style: 'currency', currency: 'HUF' })}</p>
          </div>`);
        markers.addLayer(marker);
      });
      map.addLayer(markers);
      markersRef.current = markers;
      const group = L.featureGroup(partners.map((p) => L.marker([p.lat, p.lon])));
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [loading, partners]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground text-sm">Loading map data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-800 bg-red-100 rounded-lg dark:text-red-300 dark:bg-red-950">
        Error: {error}
      </div>
    );
  }

  if (partners.length === 0) {
    return (
      <p className="p-4 text-muted-foreground">
        No partner data yet. Use POST /maps/partners/bulk to load data.
      </p>
    );
  }

  return (
    <div className="isolate h-[calc(100vh-4rem)] w-full rounded-lg overflow-hidden">
      <div ref={mapRef} className="h-full w-full" />
    </div>
  );
}
