import type { ComponentType, ReactNode } from 'react';
import { History, List, Database, RefreshCw, ArrowLeftRight, Clock, BarChart2, ListOrdered, Wrench } from 'lucide-react';
import SignIn        from '../pages/SignIn';
import Jobs          from '../pages/Jobs';
import Sync          from '../pages/db-tools/Sync';
import SyncAsync     from '../pages/db-tools/SyncAsync';
import SyncScheduled from '../pages/db-tools/SyncScheduled';
import QueryList     from '../pages/querys/QueryList';
import QueryBuilder  from '../pages/querys/QueryBuilder';

export interface RouteConfig {
  path: string;
  element?: ComponentType;
  icon?: ReactNode;
  protected: boolean;
  label?: string;
  showInNav?: boolean;
  children?: RouteConfig[];
}

const ic = 'h-4 w-4';

export const routes: RouteConfig[] = [
  { path: '/',       element: SignIn, protected: false },
  { path: '/signin', element: SignIn, protected: false },
  {
    path: '/logs',
    protected: true,
    icon: <History className={ic} />,
    label: 'Logs',
    showInNav: true,
    children: [
      { path: '/logs/jobs', element: Jobs, protected: true, icon: <List className={ic} />, label: 'Jobs', showInNav: true },
    ],
  },
  {
    path: '/db-tools',
    protected: true,
    icon: <Database className={ic} />,
    label: 'DB Tools',
    showInNav: true,
    children: [
      { path: '/db-tools/sync',           element: Sync,          protected: true, icon: <RefreshCw className={ic} />,       label: 'Sync',           showInNav: true },
      { path: '/db-tools/sync-async',     element: SyncAsync,     protected: true, icon: <ArrowLeftRight className={ic} />,  label: 'Async Sync',     showInNav: true },
      { path: '/db-tools/sync-scheduled', element: SyncScheduled, protected: true, icon: <Clock className={ic} />,           label: 'Scheduled Sync', showInNav: true },
    ],
  },
  {
    path: '/querys',
    protected: true,
    icon: <BarChart2 className={ic} />,
    label: 'Queries',
    showInNav: true,
    children: [
      { path: '/querys/list',    element: QueryList,    protected: true, icon: <ListOrdered className={ic} />, label: 'Query list',    showInNav: true },
      { path: '/querys/builder', element: QueryBuilder, protected: true, icon: <Wrench className={ic} />,      label: 'Query builder', showInNav: true },
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
