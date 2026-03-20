import type { ComponentType, ReactNode } from 'react';
import SignIn from '../pages/SignIn';
import S7StatusPage from '../pages/s7/S7StatusPage';
import ChartsPage from '../pages/charts/ChartsPage';
import NodeConfigPage from '../pages/nodeconfig/NodeConfigPage';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SettingsInputComponentIcon from '@mui/icons-material/SettingsInputComponent';

export interface RouteConfig {
  path: string;
  element?: ComponentType;
  icon?: ReactNode;
  protected: boolean;
  label?: string;
  showInNav?: boolean;
  children?: RouteConfig[];
}

export const routes: RouteConfig[] = [
  { path: '/login',  element: SignIn,       protected: false },
  { path: '/status',      element: S7StatusPage,   protected: true, icon: <MonitorHeartIcon />,            label: 'S7-1500 Status',    showInNav: true },
  { path: '/charts',      element: ChartsPage,     protected: true, icon: <ShowChartIcon />,               label: 'Charts',            showInNav: true },
  { path: '/node-config', element: NodeConfigPage, protected: true, icon: <SettingsInputComponentIcon />, label: 'Node Config',        showInNav: true },
];

export function flattenRoutes(
  list: RouteConfig[]
): (RouteConfig & { element: ComponentType })[] {
  return list.flatMap((r) => {
    const self   = r.element ? [r as RouteConfig & { element: ComponentType }] : [];
    const nested = r.children ? flattenRoutes(r.children) : [];
    return [...self, ...nested];
  });
}
