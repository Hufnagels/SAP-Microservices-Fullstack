import React, { useState, useEffect, useRef } from 'react';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet.markercluster';

import type { LatLngTuple, Map } from 'leaflet'
// import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";

import {mockApiData} from './resource/api/mock';


interface Company {
  name: string;
  address: string;
  sales: number;
  lat?: number;
  lon?: number;
}

interface CompanyWithCoords extends Company {
  lat: number;
  lon: number;
}

interface GeocodingResult {
  lat: string;
  lon: string;
}

// function download(content: any, fileName: string, contentType : string) {
//     var a = document.createElement("a");
//     var file = new Blob([content], {type: contentType});
//     a.href = URL.createObjectURL(file);
//     a.download = fileName;
//     a.click();
// }


const App: React.FC = () => {
  const [companies, setCompanies] = useState<CompanyWithCoords[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  // const mapRef1 = useRef<Map>(undefined);
  // const position: LatLngTuple = [47.49801, 19.03991]

  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.MarkerClusterGroup | null>(null);
  const [rederCount, setRederCount] = useState<number>(0);

  const geocodeAddress = async (address: string): Promise<{ lat: number; lon: number } | null> => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`
      );
      const data: GeocodingResult[] = await response.json();
      if (data && data.length > 0) {
        return {
          lat: parseFloat(data[0].lat),
          lon: parseFloat(data[0].lon),
        };
      }
      return null;
    } catch (err) {
      console.error('Geocoding error:', err);
      return null;
    }
  };

  const delay = (ms: number): Promise<void> => {
    return new Promise(resolve => setTimeout(resolve, ms));
  };

  const getMarkerColor = (sales: number): string => {
    // Categorize based on sales value
    if (sales >= 150000000) {
      return 'green'; // High sales
    } else if (sales >= 100000000) {
      return 'red'; // Medium sales
    } else if (sales >= 50000000) {
      return 'violet'; // Medium sales
    } else {
      return 'blue'; // Low sales
    }
  };

  const createColoredMarker = (lat: number, lon: number, color: string): L.Marker => {
    const markerColors: { [key: string]: string } = {
      red:    '#faa686',
      green:  '#7def9a',
      violet: '#ff9bd1',
      blue:   '#9bceff'
    };

    const colorHex = markerColors[color] || '#dfdfdf'; // '#f63ba2';
//${colorHex}
    const svgIcon = `
      <svg xmlns="http://www.w3.org/2000/svg" iewBox="0 0 45 75" width="45px" height="75px" fill="" >
        <path d="M 37.692 49.306 C 27.541 80.123 17.389 80.123 7.238 49.306 C -2.913 18.489 2.162 3.081 22.465 3.081 C 42.768 3.081 47.843 18.489 37.692 49.306 Z M 22.465 9.329 C 15.907 9.329 10.591 14.285 10.591 20.398 C 10.591 26.511 15.907 31.466 22.465 31.466 C 29.023 31.466 34.339 26.511 34.339 20.398 C 34.339 14.285 29.023 9.329 22.465 9.329 Z" 
          style="fill: ${colorHex}; stroke: #424242; stroke-width: 3px;"/>
      </svg>
      `;

    const customIcon = L.icon({
      iconUrl: `data:image/svg+xml;base64,${btoa(svgIcon)}`,
      iconSize: [36, 65],
      iconAnchor: [16, 65],
      popupAnchor: [2, -15]
    });

    return L.marker([lat, lon], { icon: customIcon });
  };

  useEffect(() => {
    if (rederCount > 0) return;

    let isMounted = true;

    const fetchData = async () => {
      let isGeocoded = false;
      try {
        setLoading(true);
        
        // Fetch data from API (currently using mock data)
        // Replace with: const response = await fetch('YOUR_API_URL');
        // const apiData: Company[] = await response.json();
        const apiData: Company[] = mockApiData;
        const companiesWithCoords: CompanyWithCoords[] = [];

        for (let i = 0; i < apiData.length; i++) {
          if (!isMounted) return;
          
          const company = apiData[i];

          // Check if already geocoded (lat and lon present)
          if (company.lat && company.lat !== 0 && company.lon && company.lon !== 0) {
            console.info(`Using existing coordinates for ${company.name}`);
            isGeocoded = true;
            companiesWithCoords.push({
                ...company,
                lat: company.lat,
                lon: company.lon,
              });
          } else {
            isGeocoded = false;
          }
          
          if (!isGeocoded) {
            console.info(`Geocoding coordinates for ${company.name}`);
            const coords = await geocodeAddress(company.address);
            if (coords) {
              companiesWithCoords.push({
                ...company,
                lat: coords.lat,
                lon: coords.lon,
              });
            }
          }
          
          if (i < apiData.length - 1) {
            if (!isGeocoded) await delay(1000);
          }
          isGeocoded = false;
        }

        setRederCount(prev => prev + 1);
        console.log('Geocoding completed. You can download the data as mock.json file.', rederCount);
        if (isMounted) {
          setCompanies(companiesWithCoords);
          
          // console.log(JSON.stringify(companiesWithCoords, null, " "))
          
          // download(JSON.stringify(companiesWithCoords, null, " "), 'mock.json', 'application/json');
          
          setLoading(false);
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'An error occurred');
          setLoading(false);
        }
      }
    };

    fetchData();

    setRederCount(prev => prev + 1);

    return () => {
      isMounted = false;
    };
  }, [companies]);

  useEffect(() => {
    if (!loading && companies.length > 0 && mapRef.current) {
      if (!mapInstanceRef.current) {
        const map = L.map(mapRef.current).setView([47.49801, 19.03991], 6);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;

        setTimeout(() => {
          map.invalidateSize();
        }, 100);
      }

      const map = mapInstanceRef.current;

      if (markersRef.current) {
        map.removeLayer(markersRef.current);
      }

      const markers = L.markerClusterGroup();

      companies.forEach((company: CompanyWithCoords) => {
        // const marker = L.marker([company.lat, company.lon]);
        const color = getMarkerColor(company.sales);
        const marker = createColoredMarker(company.lat, company.lon, color);
        
        const popupContent = `
          <div style="padding: 8px;">
            <h3 style="font-weight: bold; font-size: 1.125rem; margin-bottom: 0.5rem;">${company.name}</h3>
            <p style="font-size: 0.875rem; color: #4b5563; margin-bottom: 0.5rem;">${company.address}</p>
            <p style="font-size: 0.875rem; color: #4b5563; margin-bottom: 0.5rem;">${'2025'}</p>
            <p style="color: #059669; font-weight: 600;">Sales: ${company.sales.toLocaleString("hu-HU", { style: "currency", currency: "HUF" })}</p>
          </div>
        `;
        
        marker.bindPopup(popupContent);
        markers.addLayer(marker);
      });

      map.addLayer(markers);
      markersRef.current = markers;

      const group =  L.featureGroup(
        companies.map((c: CompanyWithCoords) => L.marker([c.lat, c.lon]))
      );

      // const group = new L.featureGroup(
      //   companies.map((c: CompanyWithCoords) => {
      //     const color = getMarkerColor(c.sales);
      //     return createColoredMarker(c.lat, c.lon, color);
      //   })
      // );
      map.fitBounds(group.getBounds().pad(0.1));
    }
  }, [loading, companies]); //loading, 

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#f3f4f6'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            border: '3px solid #f3f4f6',
            borderTop: '3px solid #2563eb',
            borderRadius: '50%',
            width: '48px',
            height: '48px',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem'
          }} />
          <p style={{ color: '#4b5563' }}>Loading company data and geocoding addresses...</p>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#f3f4f6'
      }}>
        <div style={{
          background: '#fee2e2',
          border: '1px solid #ef4444',
          color: '#991b1b',
          padding: '1rem',
          borderRadius: '0.5rem'
        }}>
          Error: {error}
        </div>
      </div>
    );
  }

  // return (
  //   <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
  //   <MapContainer center={position} zoom={13} scrollWheelZoom={false} style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
  //     <TileLayer
  //       attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  //       url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
  //     />
  //     <Marker position={position}>
  //       <Popup>
  //         A pretty CSS3 popup. <br /> Easily customizable.
  //       </Popup>
  //     </Marker>
  //   </MapContainer>
  //   </div>
  // )

  return (
    <div style={{ height: '100vh', width: '100vw', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        background: '#2563eb',
        color: 'white',
        padding: '1rem',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
          Company Sales Map
        </h1>
        <p style={{ fontSize: '0.875rem', opacity: 0.9 }}>
          {companies.length} companies displayed
        </p>
      </div>
      
      <div style={{ flex: 1, position: 'relative' }}>
        <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
      </div>
      <ToastContainer position="bottom-right" autoClose={4000} />
    </div>
  );

};

export default App;