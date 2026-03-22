import type { ComponentType, ReactNode } from 'react';
import SignIn        from '../pages/SignIn';
import Jobs          from '../pages/Jobs';
import Sync          from '../pages/db-tools/Sync';
import SyncAsync     from '../pages/db-tools/SyncAsync';
import SyncScheduled from '../pages/db-tools/SyncScheduled';
import QueryList     from '../pages/querys/QueryList';
import QueryBuilder  from '../pages/querys/QueryBuilder';
import WorkHistoryIcon    from '@mui/icons-material/WorkHistory';
import ListAltIcon        from '@mui/icons-material/ListAlt';
import StorageIcon        from '@mui/icons-material/Storage';
import SyncIcon           from '@mui/icons-material/Sync';
import SyncAltIcon        from '@mui/icons-material/SyncAlt';
import ScheduleIcon       from '@mui/icons-material/Schedule';
import QueryStatsIcon     from '@mui/icons-material/QueryStats';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import BuildIcon          from '@mui/icons-material/Build';

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
  { path: '/',       element: SignIn, protected: false },
  { path: '/signin', element: SignIn, protected: false },
  {
    path: '/logs',
    protected: true,
    icon: <WorkHistoryIcon />,
    label: 'Logs',
    showInNav: true,
    children: [
      { path: '/logs/jobs', element: Jobs, protected: true, icon: <ListAltIcon />, label: 'Jobs', showInNav: true },
    ],
  },
  {
    path: '/db-tools',
    protected: true,
    icon: <StorageIcon />,
    label: 'DB Tools',
    showInNav: true,
    children: [
      { path: '/db-tools/sync',           element: Sync,          protected: true, icon: <SyncIcon />,     label: 'Sync',           showInNav: true },
      { path: '/db-tools/sync-async',     element: SyncAsync,     protected: true, icon: <SyncAltIcon />,  label: 'Async Sync',     showInNav: true },
      { path: '/db-tools/sync-scheduled', element: SyncScheduled, protected: true, icon: <ScheduleIcon />, label: 'Scheduled Sync', showInNav: true },
    ],
  },
  {
    path: '/querys',
    protected: true,
    icon: <QueryStatsIcon />,
    label: 'Queries',
    showInNav: true,
    children: [
      { path: '/querys/list',    element: QueryList,    protected: true, icon: <FormatListBulletedIcon />, label: 'Query list',    showInNav: true },
      { path: '/querys/builder', element: QueryBuilder, protected: true, icon: <BuildIcon />,              label: 'Query builder', showInNav: true },
    ],
  },
];

export function flattenRoutes(list: RouteConfig[]): (RouteConfig & { element: ComponentType })[] {
  return list.flatMap((r) => {
    const self   = r.element ? [r as RouteConfig & { element: ComponentType }] : [];
    const nested = r.children ? flattenRoutes(r.children) : [];
    return [...self, ...nested];
  });
}
