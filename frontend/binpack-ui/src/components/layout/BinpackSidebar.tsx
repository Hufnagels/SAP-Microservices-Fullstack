import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import TextField from '@mui/material/TextField';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';
import { VITE_APP_NAME } from '../../features/config';

export const DRAWER_WIDTH = 280;

const PACKAGE_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8',
  '#F7DC6F', '#BB8FCE', '#85C1E2', '#F8B739', '#52C9C2',
];

export interface BinpackControls {
  rollDiameter: number;
  setRollDiameter: (v: number) => void;
  rollHeight: number;
  setRollHeight: (v: number) => void;
  rollWeight: number;
  setRollWeight: (v: number) => void;
  pkgLayersOnPallet: number;
  setPkgLayersOnPallet: (v: number) => void;
  packSize: number;
  setPackSize: (v: number) => void;
  layersInPackage: number;
  setLayersInPackage: (v: number) => void;
  packingMode: 'hexagonal' | 'square';
  setPackingMode: (v: 'hexagonal' | 'square') => void;
  selectedPackageIdx: number | null;
  setSelectedPackageIdx: (v: number | null) => void;
  positions: { x: number; y: number }[];
  packages: { indices: number[] }[];
  showStack: boolean;
  stackData: number[][][];
  loading: boolean;
  onSearchOpen: () => void;
  onReload: () => void;
  onRegroup: () => void;
  onDownloadKuka: () => void;
}

function DrawerContent({ controls }: { controls: BinpackControls }) {
  const {
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
    onSearchOpen, onReload, onRegroup, onDownloadKuka,
  } = controls;

  const utilization = positions.length > 0
    ? (positions.length * Math.PI * (rollDiameter / 2) * (rollDiameter / 2)) / (800 * 1200) * 100
    : 0;

  return (
    <>
      <Toolbar sx={{ px: 2 }}>
        <Typography variant="h6" fontWeight={700} color="primary" noWrap>
          {VITE_APP_NAME}
        </Typography>
      </Toolbar>
      <Divider />

      <Box sx={{ p: 1.5, overflowY: 'auto', flex: 1 }}>
        {/* Action buttons */}
        <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
          <IconButton
            onClick={onSearchOpen}
            title="Search Item"
            size="small"
            sx={{ flex: 1, bgcolor: 'primary.main', color: 'white', borderRadius: 1,
              '&:hover': { bgcolor: 'primary.dark' } }}
          >
            <SearchIcon fontSize="small" />
          </IconButton>
          <IconButton
            onClick={onReload}
            disabled={loading}
            title="Reload Layer"
            size="small"
            sx={{ flex: 1, bgcolor: 'primary.main', color: 'white', borderRadius: 1,
              '&:hover': { bgcolor: 'primary.dark' },
              '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
          {showStack && stackData.length > 0 && (
            <IconButton
              onClick={onDownloadKuka}
              disabled={loading}
              title="Download KUKA KRL template"
              size="small"
              sx={{ flex: 1, bgcolor: 'primary.main', color: 'white', borderRadius: 1,
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground' } }}
            >
              <DownloadIcon fontSize="small" />
            </IconButton>
          )}
        </Stack>

        {/* Roll parameters */}
        <TextField
          label="Roll diameter [mm]"
          type="number"
          size="small"
          fullWidth
          value={rollDiameter}
          onChange={e => setRollDiameter(parseFloat(e.target.value) || 0)}
          sx={{ mb: 1 }}
          slotProps={{ htmlInput: { min: 0 } }}
        />
        <TextField
          label="Roll height [mm]"
          type="number"
          size="small"
          fullWidth
          value={rollHeight}
          onChange={e => setRollHeight(parseFloat(e.target.value) || 0)}
          sx={{ mb: 1 }}
          slotProps={{ htmlInput: { min: 0 } }}
        />
        <TextField
          label="Roll weight [kg]"
          type="number"
          size="small"
          fullWidth
          value={rollWeight}
          onChange={e => setRollWeight(parseFloat(e.target.value) || 0)}
          sx={{ mb: 1 }}
          slotProps={{ htmlInput: { min: 0, step: 0.001 } }}
        />
        <TextField
          label="Package layers on pallet"
          type="number"
          size="small"
          fullWidth
          value={pkgLayersOnPallet}
          onChange={e => setPkgLayersOnPallet(parseInt(e.target.value) || 1)}
          sx={{ mb: 1 }}
          slotProps={{ htmlInput: { min: 1, max: 20 } }}
        />

        <FormControl size="small" fullWidth sx={{ mb: 1 }}>
          <InputLabel>Packing Mode</InputLabel>
          <Select
            value={packingMode}
            label="Packing Mode"
            onChange={e => setPackingMode(e.target.value as 'hexagonal' | 'square')}
          >
            <MenuItem value="hexagonal">Hexagonal</MenuItem>
            <MenuItem value="square">Square</MenuItem>
          </Select>
        </FormControl>

        <Stack direction="row" spacing={1} alignItems="flex-end" sx={{ mb: 1 }}>
          <TextField
            label="Pack size (rolls/layer)"
            type="number"
            size="small"
            value={packSize}
            onChange={e => setPackSize(parseInt(e.target.value) || 1)}
            sx={{ flex: 1 }}
            slotProps={{ htmlInput: { min: 1, max: 50 } }}
          />
          <Button variant="outlined" size="small" onClick={onRegroup} sx={{ flexShrink: 0 }}>
            Re-group
          </Button>
        </Stack>

        <TextField
          label="Layers in package"
          type="number"
          size="small"
          fullWidth
          value={layersInPackage}
          onChange={e => setLayersInPackage(parseInt(e.target.value) || 1)}
          sx={{ mb: 1.5 }}
          slotProps={{ htmlInput: { min: 1, max: 20 } }}
        />

        <Divider sx={{ mb: 1.5 }} />

        {/* Info stats */}
        <Box sx={{ mb: 1 }}>
          <Typography variant="body2">Total rolls: <strong>{positions.length}</strong></Typography>
          <Typography variant="body2">Packages: <strong>{packages.length}</strong></Typography>
          {layersInPackage > 1 && (
            <Typography variant="body2">
              Rolls/package: <strong>{packSize * layersInPackage}</strong> ({packSize} × {layersInPackage} layers)
            </Typography>
          )}
          <Typography variant="body2">Pkg layers on pallet: <strong>{pkgLayersOnPallet}</strong></Typography>
          <Typography variant="body2">
            Stack height: <strong>{(pkgLayersOnPallet * layersInPackage * rollHeight).toFixed(0)} mm</strong>
          </Typography>
          <Typography variant="body2">Utilization: <strong>{utilization.toFixed(1)}%</strong></Typography>
        </Box>

        {/* Package list */}
        {packages.length > 0 && !showStack && (
          <Box>
            <Divider sx={{ mb: 1 }} />
            <Typography variant="caption" color="text.secondary">Packages</Typography>
            <Box sx={{ maxHeight: 180, overflowY: 'auto', mt: 0.5 }}>
              {packages.map((pkg, idx) => (
                <Box
                  key={idx}
                  onClick={() => setSelectedPackageIdx(selectedPackageIdx === idx ? null : idx)}
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    px: 1,
                    py: 0.5,
                    cursor: 'pointer',
                    borderRadius: 1,
                    border: '2px solid',
                    borderColor: selectedPackageIdx === idx ? 'warning.main' : 'transparent',
                    bgcolor: selectedPackageIdx === idx ? 'warning.light' : 'transparent',
                    '&:hover': { bgcolor: 'action.hover' },
                    mb: 0.25,
                  }}
                >
                  <Box sx={{
                    width: 12, height: 12, borderRadius: '50%', flexShrink: 0,
                    bgcolor: PACKAGE_COLORS[idx % PACKAGE_COLORS.length],
                  }} />
                  <Typography variant="caption">Package {idx + 1}: {pkg.indices.length} rolls</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        )}
      </Box>
    </>
  );
}

interface BinpackSidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
  controls: BinpackControls;
}

export default function BinpackSidebar({ mobileOpen, onMobileClose, controls }: BinpackSidebarProps) {
  const content = <DrawerContent controls={controls} />;

  return (
    <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
      <Drawer
        variant="temporary"
        anchor="left"
        open={mobileOpen}
        onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{
          display: { xs: 'block', sm: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
      >
        {content}
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
        open
      >
        {content}
      </Drawer>
    </Box>
  );
}
