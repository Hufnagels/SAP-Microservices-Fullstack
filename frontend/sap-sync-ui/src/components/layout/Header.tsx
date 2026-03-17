import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import IconButton from '@mui/material/IconButton';
import Avatar from '@mui/material/Avatar';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import Brightness7Icon from '@mui/icons-material/Brightness7';
import { toggleTheme } from '../../features/theme/themeSlice';
import { signOut } from '../../features/auth/authSlice';
import type { RootState, AppDispatch } from '../../app/store';
import { DRAWER_WIDTH } from './Sidebar';
import { VITE_APP_NAME } from '../../features/config';

interface HeaderProps { onMenuClick: () => void; }

export default function Header({ onMenuClick }: HeaderProps) {
  const dispatch   = useDispatch<AppDispatch>();
  const navigate   = useNavigate();
  const themeMode  = useSelector((s: RootState) => s.theme.mode);
  const user       = useSelector((s: RootState) => s.auth.user);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleSignOut = () => {
    setAnchorEl(null);
    dispatch(signOut());
    navigate('/');
  };

  return (
    <AppBar position="fixed" sx={{ width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` }, ml: { sm: `${DRAWER_WIDTH}px` } }}>
      <Toolbar>
        <IconButton color="inherit" edge="start" onClick={onMenuClick} sx={{ mr: 2, display: { sm: 'none' } }}>
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" noWrap sx={{ flexGrow: 1 }}>
          {VITE_APP_NAME}
        </Typography>

        <IconButton color="inherit" onClick={() => dispatch(toggleTheme())}>
          {themeMode === 'dark' ? <Brightness7Icon /> : <Brightness4Icon />}
        </IconButton>

        <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 1 }}>
          <Avatar
            src={user?.avatar_mode === 'image' && user.avatar_base64 ? user.avatar_base64 : undefined}
            sx={{ bgcolor: 'primary.light', width: 36, height: 36, fontSize: '1rem' }}
          >
            {user?.name?.[0]?.toUpperCase() ?? 'U'}
          </Avatar>
        </IconButton>

        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
          <MenuItem disabled>
            <Typography variant="body2" color="text.secondary">{user?.username ?? ''}</Typography>
          </MenuItem>
          <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
