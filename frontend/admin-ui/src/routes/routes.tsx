import type { ComponentType, ReactNode } from 'react';
import Landing from '../pages/Landing';
import SignIn from '../pages/SignIn';
import Dashboard from '../pages/Dashboard';
import UserAccount from '../pages/users/UserAccount';
import Charts from '../pages/charts/Charts';
import RidgelineChart from '../pages/charts/RidgelineChart';
import UsersPage from '../pages/users/Users';
import Permissions from '../pages/users/Permissions';
import FileManager from '../pages/files/FileManager';
import FileManager2 from '../pages/files/FileManager2';
import ServiceList from '../pages/services/ServiceList';
import ServiceManage from '../pages/services/ServiceManage';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PersonIcon from '@mui/icons-material/Person';
import BarChartIcon from '@mui/icons-material/BarChart';
import DonutSmallIcon from '@mui/icons-material/DonutSmall';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import SecurityIcon from '@mui/icons-material/Security';
import FolderIcon from '@mui/icons-material/Folder';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import MiscellaneousServicesIcon from '@mui/icons-material/MiscellaneousServices';
import SettingsIcon from '@mui/icons-material/Settings';
import ListAltIcon from '@mui/icons-material/ListAlt';

export interface RouteConfig {
  path: string;
  element?: ComponentType;   // undefined for group-only nodes
  icon?: ReactNode;
  protected: boolean;
  label?: string;
  showInNav?: boolean;
  children?: RouteConfig[];
}

export const routes: RouteConfig[] = [
  { path: '/',           element: Landing,       protected: false },
  { path: '/signin',     element: SignIn,         protected: false },
  { path: '/dashboard',  element: Dashboard,      protected: true, icon: <DashboardIcon />,  label: 'Dashboard',    showInNav: true  },
  { path: '/account',    element: UserAccount,    protected: true, icon: <PersonIcon />,      label: 'User Account', showInNav: false },
  {
    path: '/charts',
    protected: true,
    icon: <BarChartIcon />,
    label: 'Charts',
    showInNav: true,
    children: [
      { path: '/charts/barchart',  element: Charts,         protected: true, icon: <DonutSmallIcon />, label: 'Bar & Donut', showInNav: true },
      { path: '/charts/ridgeline', element: RidgelineChart, protected: true, icon: <ShowChartIcon />,  label: 'Ridgeline',   showInNav: true },
    ],
  },
  {
    path: '/users',
    protected: true,
    icon: <SupervisorAccountIcon />,
    label: 'Users',
    showInNav: true,
    children: [
      { path: '/users/list',        element: UsersPage,    protected: true, icon: <SupervisorAccountIcon />, label: 'User List',   showInNav: true },
      { path: '/users/permissions', element: Permissions,  protected: true, icon: <SecurityIcon />,          label: 'Permissions', showInNav: true },
    ],
  },
  
  {
    path: '/files',
    protected: true,
    icon: <FolderIcon />,
    label: 'Files',
    showInNav: true,
    children: [
      { path: '/files/files1',  element: FileManager,  protected: true, icon: <FolderIcon />,     label: 'Files',    showInNav: true },
      { path: '/files/files2', element: FileManager2, protected: true, icon: <FolderOpenIcon />, label: 'Files v2', showInNav: true },
    ],
  },
  {
    path: '/services',
    protected: true,
    icon: <MiscellaneousServicesIcon />,
    label: 'Services',
    showInNav: true,
    children: [
      { path: '/services/list',   element: ServiceList,   protected: true, icon: <ListAltIcon />,  label: 'Service List', showInNav: true  },
      { path: '/services/manage', element: ServiceManage, protected: true, icon: <SettingsIcon />, label: 'Manage',       showInNav: false },
    ],
  },
];

/** Flatten tree into routable leaf nodes (only nodes with an element). */
export function flattenRoutes(
  list: RouteConfig[]
): (RouteConfig & { element: ComponentType })[] {
  return list.flatMap((r) => {
    const self = r.element ? [r as RouteConfig & { element: ComponentType }] : [];
    const nested = r.children ? flattenRoutes(r.children) : [];
    return [...self, ...nested];
  });
}
