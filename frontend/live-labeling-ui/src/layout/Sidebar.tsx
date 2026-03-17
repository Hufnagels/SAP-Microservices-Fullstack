import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import { alpha } from '@mui/material/styles';

export const DRAWER_WIDTH = 240;

const activeItemSx = {
  '&.Mui-selected': {
    bgcolor: (theme: any) => alpha(theme.palette.primary.main, 0.12),
    borderRight: '3px solid',
    borderColor: 'primary.main',
    '& .MuiListItemIcon-root': { color: 'primary.main' },
    '& .MuiListItemText-primary': { color: 'primary.main', fontWeight: 700 },
    '&:hover': {
      bgcolor: (theme: any) => alpha(theme.palette.primary.main, 0.18),
    },
  },
};

function DrawerContent() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <>
      <Toolbar sx={{ px: 2 }}>
        <Typography variant="subtitle1" fontWeight={800} color="primary" noWrap letterSpacing="0.12em">
          CAB SQUIX
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ pt: 1 }}>
        <ListItemButton
          selected={pathname === '/designer'}
          onClick={() => navigate('/designer')}
          sx={{ minHeight: 48, pl: 2, pr: 2, ...activeItemSx }}
        >
          <ListItemIcon sx={{ minWidth: 0, mr: 2 }}>
            <DesignServicesIcon />
          </ListItemIcon>
          <ListItemText primary="Label Designer" />
        </ListItemButton>
      </List>
    </>
  );
}

interface SidebarProps {
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const drawerContent = <DrawerContent />;

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
        {drawerContent}
      </Drawer>

      <Drawer
        variant="permanent"
        sx={{
          display: { xs: 'none', sm: 'block' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
        open
      >
        {drawerContent}
      </Drawer>
    </Box>
  );
}
