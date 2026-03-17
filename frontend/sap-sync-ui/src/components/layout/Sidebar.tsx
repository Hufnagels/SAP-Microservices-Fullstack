import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { alpha } from '@mui/material/styles';
import { routes } from '../../routes/routes';
import type { RouteConfig } from '../../routes/routes';
import { VITE_APP_NAME } from '../../features/config';

export const DRAWER_WIDTH = 240;

const activeItemSx = {
  '&.Mui-selected': {
    bgcolor: (theme: any) => alpha(theme.palette.primary.main, 0.12),
    borderRight: '3px solid',
    borderColor: 'primary.main',
    '& .MuiListItemIcon-root': { color: 'primary.main' },
    '& .MuiListItemText-primary': { color: 'primary.main', fontWeight: 700 },
    '&:hover': { bgcolor: (theme: any) => alpha(theme.palette.primary.main, 0.18) },
  },
};

function NavItem({ route, indent = false }: { route: RouteConfig; indent?: boolean }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (
    <ListItemButton
      selected={pathname === route.path}
      onClick={() => navigate(route.path!)}
      sx={{ minHeight: 48, pl: indent ? 4 : 2, pr: 2, ...activeItemSx }}
    >
      <ListItemIcon sx={{ minWidth: 0, mr: 2 }}>{route.icon}</ListItemIcon>
      <ListItemText
        primary={route.label}
        slotProps={{ primary: { variant: indent ? 'body2' : 'body1' } }}
      />
    </ListItemButton>
  );
}

function NavGroup({ route }: { route: RouteConfig }) {
  const { pathname } = useLocation();
  const childPaths    = route.children?.map((c) => c.path) ?? [];
  const isChildActive = childPaths.includes(pathname);
  const [localOpen, setLocalOpen] = useState(isChildActive);
  return (
    <>
      <ListItemButton
        onClick={() => setLocalOpen((p) => !p)}
        sx={{
          minHeight: 48, pl: 2, pr: 2,
          '& .MuiListItemIcon-root': { color: isChildActive ? 'primary.main' : 'inherit' },
        }}
      >
        <ListItemIcon sx={{ minWidth: 0, mr: 2 }}>{route.icon}</ListItemIcon>
        <ListItemText primary={route.label} />
        {localOpen ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
      </ListItemButton>
      <Collapse in={localOpen} timeout="auto" unmountOnExit>
        <List disablePadding>
          {route.children?.filter((c) => c.showInNav).map((child) => (
            <NavItem key={child.path} route={child} indent />
          ))}
        </List>
      </Collapse>
    </>
  );
}

function DrawerContent() {
  const navRoutes = routes.filter((r) => r.showInNav);
  return (
    <>
      <Toolbar sx={{ px: 2 }}>
        <Typography variant="h6" fontWeight={700} color="primary" noWrap>
          {VITE_APP_NAME}
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ pt: 1 }}>
        {navRoutes.map((route) =>
          route.children
            ? <NavGroup key={route.path} route={route} />
            : <NavItem  key={route.path} route={route} />
        )}
      </List>
    </>
  );
}

interface SidebarProps { mobileOpen: boolean; onMobileClose: () => void; }

export default function Sidebar({ mobileOpen, onMobileClose }: SidebarProps) {
  const content = <DrawerContent />;
  return (
    <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
      <Drawer
        variant="temporary" anchor="left" open={mobileOpen} onClose={onMobileClose}
        ModalProps={{ keepMounted: true }}
        sx={{ display: { xs: 'block', sm: 'none' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        {content}
      </Drawer>
      <Drawer
        variant="permanent" open
        sx={{ display: { xs: 'none', sm: 'block' }, '& .MuiDrawer-paper': { width: DRAWER_WIDTH } }}
      >
        {content}
      </Drawer>
    </Box>
  );
}
