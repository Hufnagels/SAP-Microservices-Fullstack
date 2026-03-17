import { useEffect, useRef, useState, Suspense, FC } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
import { CameraControls, GizmoHelper, GizmoViewport, PivotControls } from '@react-three/drei';
import { STLLoader } from 'three-stdlib';
import { Color } from 'three';
import { toast } from 'react-toastify';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import FormControlLabel from '@mui/material/FormControlLabel';
import Checkbox from '@mui/material/Checkbox';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import BinpackHeader from '../components/layout/BinpackHeader';
import BinpackSidebar, { DRAWER_WIDTH } from '../components/layout/BinpackSidebar';
import type { BinpackControls } from '../components/layout/BinpackSidebar';

const API = (import.meta.env.VITE_API_URL || '') + '/binpack';

const PACKAGE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52C9C2',
];

const PKG_LAYER_PALETTES: string[][] = [
  ['#FF6B6B', '#FF9F43', '#FECA57'],
  ['#48DBFB', '#0ABDE3', '#54A0FF'],
  ['#55EFC4', '#00B894', '#00CEC9'],
  ['#A29BFE', '#6C5CE7', '#FD79A8'],
  ['#FDCB6E', '#E17055', '#D63031'],
  ['#DFE6E9', '#B2BEC3', '#636E72'],
];

const PALLET_WIDTH = 800;
const PALLET_LENGTH = 1200;
const BG_COLOR = [0xaaaaaa];

interface Item {
  ItemCode: string;
  ItemName: string;
  U_NTT_ATMERO: number;
  U_NTT_VAGAS: number;
  U_NTT_RETEG: number;
  __GRAMM: number;
  U_NTT_HOSSZM: number;
  SZÉLSELEJT: number;
  U_NTT_TEKERCSSZAM: number;
  U_BRD_Raklap_zsugorsor: number;
  [key: string]: unknown;
}

interface Position { x: number; y: number }
interface BBox {
  min_x: number; min_y: number; max_x: number; max_y: number;
  width: number; height: number; center_x: number; center_y: number;
}
interface Package { indices: number[]; bbox?: BBox | null }
interface OptimizeLayerResponse { count: number; positions: Position[]; bbox?: BBox | null }
interface PackageResponse { packages: Package[] }
interface StackResponse { layers: number[][][] }

// ── Item search modal ──────────────────────────────────────────────────────────
const SearchModal: FC<{ onClose: () => void; onSelect: (item: Item) => void }> = ({ onClose, onSelect }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/items`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((data: Item[]) => setItems(data))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const q = filter.toLowerCase();
  const filtered = items.filter(
    it => it.ItemCode.toLowerCase().includes(q) || it.ItemName.toLowerCase().includes(q)
  );

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Select Item</h3>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <input
          className="modal-search"
          type="text"
          placeholder="Filter by code or name…"
          value={filter}
          onChange={e => setFilter(e.target.value)}
          autoFocus
        />
        <div className="modal-list">
          {loading && <p className="modal-status">Loading…</p>}
          {error && <p className="modal-status error">{error}</p>}
          {!loading && !error && filtered.length === 0 && <p className="modal-status">No items found.</p>}
          {filtered.map(item => (
            <div key={item.ItemCode} className="modal-item" onClick={() => onSelect(item)}>
              <span className="modal-item-code">{item.ItemCode} - {item.U_NTT_ATMERO}</span>
              <span className="modal-item-name">{item.ItemName}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── 2D canvas components ───────────────────────────────────────────────────────
const CirclePackages: FC<{
  positions: Position[]; packages: Package[]; selectedPackageIdx: number | null; rollRadius: number;
}> = ({ positions, packages, selectedPackageIdx, rollRadius }) => {
  const positionToColor: Record<number, string> = {};
  packages.forEach((pkg, pkgIdx) => {
    const color = PACKAGE_COLORS[pkgIdx % PACKAGE_COLORS.length];
    pkg.indices.forEach(posIdx => { positionToColor[posIdx] = color; });
  });
  return (
    <group>
      {positions.map((p, i) => {
        const baseColor = positionToColor[i] || '#ffffff';
        const isSelected = selectedPackageIdx !== null && packages[selectedPackageIdx]?.indices.includes(i);
        return (
          <mesh key={`circle-${i}`} position={[p.x * 0.01, p.y * 0.01, 0]}>
            <circleGeometry args={[rollRadius * 0.01, 32]} />
            <meshBasicMaterial color={isSelected ? '#ffff00' : baseColor} />
          </mesh>
        );
      })}
    </group>
  );
};

const CirclesPlain: FC<{ points: Position[]; rollRadius: number }> = ({ points, rollRadius }) => (
  <group>
    {points.map((p, i) => (
      <mesh key={i} position={[p.x * 0.01, p.y * 0.01, 0]}>
        <circleGeometry args={[rollRadius * 0.01, 32]} />
        <meshBasicMaterial color="orange" />
      </mesh>
    ))}
  </group>
);

const PackageRectangles: FC<{ packages: Package[]; selectedIdx: number | null }> = ({ packages, selectedIdx }) => (
  <group>
    {packages.map((pkg, i) => {
      const bbox = pkg.bbox;
      if (!bbox) return null;
      const w = bbox.width * 0.01;
      const h = bbox.height * 0.01;
      const x = bbox.center_x * 0.01;
      const y = bbox.center_y * 0.01;
      return (
        <mesh key={`pkgrect-${i}`} position={[x, y, 0.5]}>
          <boxGeometry args={[w, h, 0.2]} />
          <meshStandardMaterial color={i === selectedIdx ? '#00ff00' : '#ffffff'} transparent opacity={0.25} />
        </mesh>
      );
    })}
  </group>
);

const PalletOutline: FC = () => (
  <mesh>
    <boxGeometry args={[PALLET_WIDTH * 0.01, PALLET_LENGTH * 0.01, 0.1]} />
    <meshBasicMaterial color="#888888" wireframe />
  </mesh>
);

// ── API Log panel (draggable) ──────────────────────────────────────────────────
const LogPanel: FC<{ logs: string[]; onClear: () => void }> = ({ logs, onClear }) => {
  const [pos, setPos] = useState({ x: window.innerWidth - 378, y: window.innerHeight - 378 });
  const dragging = useRef(false);
  const offset = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return;
      setPos({ x: e.clientX - offset.current.x, y: e.clientY - offset.current.y });
    };
    const onUp = () => { dragging.current = false; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div className="log-panel" style={{ left: pos.x, top: pos.y }}>
      <div
        className="log-panel-header"
        onMouseDown={e => {
          dragging.current = true;
          offset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y };
        }}
      >
        <span>API Log</span>
        <button onClick={onClear} title="Clear">✕</button>
      </div>
      <div className="log-panel-body">
        {logs.length === 0
          ? <span className="log-empty">No calls yet.</span>
          : [...logs].reverse().map((l, i) => <div key={i} className="log-entry">{l}</div>)
        }
      </div>
    </div>
  );
};

// ── Lighting ───────────────────────────────────────────────────────────────────
const Lighting: FC<{ color: number[] }> = ({ color }) => (
  <>
    <color attach="background" args={color as [number]} />
    <group>
      <ambientLight intensity={3.0} />
      <directionalLight position={[0, 8, 5]} intensity={1.5} castShadow />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <ambientLight intensity={0.5} />
      <directionalLight intensity={0.5} color="white" />
      <ambientLight intensity={0.3} />
      <pointLight position={[100, 100, 100]} />
      <pointLight position={[-20, 20, 20]} />
    </group>
  </>
);

// ── 3D pallet mesh (STL) ───────────────────────────────────────────────────────
const MeshPallet: FC = () => {
  const palletMesh = useLoader(STLLoader, '/textures/pallet/EUR_1-pallet_full-size_800_mm__1200_mm_assembled.stl');
  return (
    <>
      <ambientLight />
      <pointLight position={[0, 100, 10]} />
      <directionalLight castShadow />
      <group rotation={[0, 0, -Math.PI / 2]} scale={[0.01, 0.01, 0.01]}>
        <mesh position={[0, 0, -145]}>
          <primitive object={palletMesh} />
          <meshStandardMaterial attach="material" color="#A1662F" />
        </mesh>
      </group>
    </>
  );
};

// ── 3D stack view ──────────────────────────────────────────────────────────────
const StackView: FC<{ stackData: number[][][]; rollRadius: number; rollHeight: number; layersInPackage: number }> = ({
  stackData, rollRadius, rollHeight, layersInPackage
}) => {
  const scale = 0.01;
  const layers = Math.max(layersInPackage, 1);
  return (
    <group>
      {stackData.map((layer, layerIdx) => {
        const pkgLayerIdx = Math.floor(layerIdx / layers);
        const rollLayerIdx = layerIdx % layers;
        const palette = PKG_LAYER_PALETTES[pkgLayerIdx % PKG_LAYER_PALETTES.length];
        const color = palette[rollLayerIdx % palette.length];
        return layer.map((pos, rollIdx) => {
          const [x, y, z] = pos;
          return (
            <mesh
              key={`l${layerIdx}-r${rollIdx}`}
              position={[x * scale, y * scale, z * scale]}
              rotation={[Math.PI / 2, 0, 0]}
            >
              <cylinderGeometry args={[rollRadius * scale, rollRadius * scale, rollHeight * scale, 24]} />
              <meshStandardMaterial color={color} />
            </mesh>
          );
        });
      })}
    </group>
  );
};

// ── Main BinpackPage ───────────────────────────────────────────────────────────
export default function BinpackPage() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [stackData, setStackData] = useState<number[][][]>([]);

  const [viewMode, setViewMode] = useState<'packages' | 'layer'>('packages');
  const [showStack, setShowStack] = useState(false);
  const [overhang, setOverhang] = useState(true);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const [rollDiameter, setRollDiameter] = useState(125);
  const [rollHeight, setRollHeight] = useState(90);
  const [rollWeight, setRollWeight] = useState(0);
  const [pkgLayersOnPallet, setPkgLayersOnPallet] = useState(11);
  const [packSize, setPackSize] = useState(6);
  const [layersInPackage, setLayersInPackage] = useState(2);
  const [packingMode, setPackingMode] = useState<'hexagonal' | 'square'>('square');
  const [selectedPackageIdx, setSelectedPackageIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (msg: string) => {
    const t = new Date().toTimeString().slice(0, 8);
    setLogs(prev => [...prev, `[${t}] ${msg}`]);
  };

  const rollRadius = rollDiameter / 2;

  const handleItemSelect = (item: Item) => {
    const heightMm = item.U_NTT_VAGAS * 10;
    setRollDiameter(item.U_NTT_ATMERO * 10);
    setRollHeight(heightMm);
    const weight = item.__GRAMM * item.U_NTT_RETEG * item.U_NTT_VAGAS * item.U_NTT_HOSSZM * item.SZÉLSELEJT / 100000;
    setRollWeight(Math.round(weight * 1000) / 1000);
    const layers = item.U_BRD_Raklap_zsugorsor || 1;
    setLayersInPackage(layers);
    setPkgLayersOnPallet(Math.max(1, Math.floor(2150 / (layers * heightMm))));
    setPackSize(Math.round(item.U_NTT_TEKERCSSZAM / layers));
    setShowSearchModal(false);
  };

  const loadLayer = async (): Promise<void> => {
    setLoading(true);
    setSelectedPackageIdx(null);
    setStackData([]);
    try {
      const res = await fetch(`${API}/optimize-layer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pallet_width: PALLET_WIDTH, pallet_length: PALLET_LENGTH,
          roll_diameter: rollDiameter, roll_height: rollHeight,
          roll_weight: rollWeight, packing_mode: packingMode,
          overhang, pack_size: packSize,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: OptimizeLayerResponse = await res.json();
      const pts = data.positions.map(p => ({ x: p.x, y: p.y }));
      addLog(`POST /optimize-layer → ${pts.length} rolls`);
      setPositions(pts);
      await groupPackages(pts, packSize);
    } catch (err) {
      addLog(`POST /optimize-layer → ERR ${err instanceof Error ? err.message : err}`);
      toast.error(err instanceof Error ? err.message : 'Optimize layer failed');
    } finally {
      setLoading(false);
    }
  };

  const groupPackages = async (pts: Position[], size: number): Promise<void> => {
    if (pts.length === 0) return;
    try {
      const body: Record<string, unknown> = {
        layer_positions: pts.map(p => ({ x: p.x, y: p.y })),
        roll_diameter: rollDiameter, pack_size: size,
        pallet_width: 0, pallet_length: 0,
      };
      if (rollWeight > 0) body.weights = new Array(pts.length).fill(rollWeight);
      const res = await fetch(`${API}/package`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: PackageResponse = await res.json();
      addLog(`POST /package → ${data.packages.length} pkgs`);
      setPackages(data.packages);
    } catch (err) {
      addLog(`POST /package → ERR ${err instanceof Error ? err.message : err}`);
      toast.error(err instanceof Error ? err.message : 'Package grouping failed');
    }
  };

  const downloadKukaTemplate = async (): Promise<void> => {
    if (stackData.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/robot-template`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layers: stackData, pick_z_clearance: rollRadius }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { picks: unknown[]; krl_program: string } = await res.json();
      addLog(`POST /robot-template → ${data.picks.length} picks`);
      const blob = new Blob([data.krl_program], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'palletize_template.src'; a.click();
      URL.revokeObjectURL(url);
      toast.success('KUKA template downloaded');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download failed');
    } finally {
      setLoading(false);
    }
  };

  const loadStack = async (): Promise<void> => {
    if (positions.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/stack-layers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_layer_positions: positions.map(p => ({ x: p.x, y: p.y })),
          roll_height: rollHeight,
          bin_max_height: pkgLayersOnPallet * layersInPackage * rollHeight,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: StackResponse = await res.json();
      addLog(`POST /stack-layers → ${data.layers.length} layers`);
      setStackData(data.layers);
    } catch (err) {
      addLog(`POST /stack-layers → ERR ${err instanceof Error ? err.message : err}`);
      toast.error(err instanceof Error ? err.message : 'Stack layers failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch(`${API}/health`)
      .then(r => {
        if (r.ok) {
          addLog('GET /health → ok');
          toast.success('Backend connected', { toastId: 'health', autoClose: 2000 });
        } else {
          addLog(`GET /health → ${r.status}`);
          toast.error('Backend unreachable', { toastId: 'health', autoClose: false });
        }
      })
      .catch(() => {
        addLog('GET /health → unreachable');
        toast.error('Backend unreachable', { toastId: 'health', autoClose: false });
      });
  }, []);

  useEffect(() => { loadLayer(); }, [packingMode, overhang, packSize, layersInPackage]);
  useEffect(() => { if (showStack) loadStack(); else setStackData([]); }, [showStack]);
  useEffect(() => { if (showStack && positions.length > 0) loadStack(); }, [positions, pkgLayersOnPallet]);

  const controls: BinpackControls = {
    rollDiameter, setRollDiameter,
    rollHeight, setRollHeight,
    rollWeight, setRollWeight,
    pkgLayersOnPallet, setPkgLayersOnPallet,
    packSize, setPackSize,
    layersInPackage, setLayersInPackage,
    packingMode, setPackingMode,
    selectedPackageIdx, setSelectedPackageIdx,
    positions, packages,
    showStack, stackData,
    loading,
    onSearchOpen: () => setShowSearchModal(true),
    onReload: loadLayer,
    onRegroup: () => groupPackages(positions, packSize),
    onDownloadKuka: downloadKukaTemplate,
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <BinpackHeader onMenuClick={() => setMobileOpen(prev => !prev)} />
      <BinpackSidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        controls={controls}
      />

      {/* Main content area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          display: 'flex',
          flexDirection: 'column',
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          height: '100vh',
          overflow: 'hidden',
        }}
      >
        {/* AppBar spacer */}
        <Toolbar />

        {/* Secondary toolbar: OverSize, ViewMode, ShowStack */}
        <Paper
          elevation={1}
          square
          sx={{
            px: 2, py: 1.5,
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            flexShrink: 0,
            bgcolor: 'background.paper',
            borderBottom: '1px solid',
            borderColor: 'divider',
          }}
        >
          <FormControlLabel
            control={
              <Checkbox
                checked={overhang}
                onChange={e => setOverhang(e.target.checked)}
                size="small"
              />
            }
            label="OverSize"
          />

          <FormControl size="small" sx={{ minWidth: 140 }} disabled={showStack}>
            <InputLabel>View Mode</InputLabel>
            <Select
              value={viewMode}
              label="View Mode"
              onChange={e => setViewMode(e.target.value as 'packages' | 'layer')}
            >
              <MenuItem value="packages">Packages</MenuItem>
              <MenuItem value="layer">Layer</MenuItem>
            </Select>
          </FormControl>

          <FormControlLabel
            control={
              <Checkbox
                checked={showStack}
                onChange={e => setShowStack(e.target.checked)}
                size="small"
              />
            }
            label="Show 3D Stack"
          />
        </Paper>

        {/* Three.js Canvas */}
        <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {showStack ? (
            <Canvas
              key="3d-stack"
              camera={{ zoom: 0.6, fov: 50, position: [0, -15, 10] }}
              onCreated={({ scene }) => { scene.background = new Color(0xaaaaaa); }}
              style={{ width: '100%', height: '100%' }}
            >
              <Lighting color={BG_COLOR} />
              <Suspense fallback={null}>
                <PivotControls anchor={[-1.0, -1.0, -1.0]} scale={0.7} lineWidth={3.5}>
                  <MeshPallet />
                  <StackView stackData={stackData} rollRadius={rollRadius} rollHeight={rollHeight} layersInPackage={layersInPackage} />
                </PivotControls>
              </Suspense>
              <CameraControls />
              <GizmoHelper alignment="bottom-right" margin={[60, 60]}>
                <GizmoViewport axisColors={['#f00', '#0f0', '#00f']} labelColor="white" />
              </GizmoHelper>
            </Canvas>
          ) : (
            <Canvas
              key="2d-layer"
              orthographic
              camera={{ zoom: 50, fov: 50, position: [0, 0, 500] }}
              onCreated={({ scene }) => { scene.background = new Color(0xffffff); }}
              style={{ width: '100%', height: '100%' }}
            >
              <ambientLight intensity={1.2} />
              <PalletOutline />
              {viewMode === 'packages' && packages.length > 0 ? (
                <>
                  <PackageRectangles packages={packages} selectedIdx={selectedPackageIdx} />
                  <CirclePackages positions={positions} packages={packages} selectedPackageIdx={selectedPackageIdx} rollRadius={rollRadius} />
                </>
              ) : (
                <CirclesPlain points={positions} rollRadius={rollRadius} />
              )}
            </Canvas>
          )}
        </Box>
      </Box>

      {/* Overlays */}
      <LogPanel logs={logs} onClear={() => setLogs([])} />
      {showSearchModal && (
        <SearchModal onClose={() => setShowSearchModal(false)} onSelect={handleItemSelect} />
      )}
    </Box>
  );
}
