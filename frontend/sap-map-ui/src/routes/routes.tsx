import type { ComponentType, ReactNode } from 'react';
import { Map } from 'lucide-react';
import Landing from '../pages/Landing';
import SignIn from '../pages/SignIn';
import MapPage from '../pages/map/MapPage';
import UserAccount from '../pages/users/UserAccount';

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
  { path: '/',        element: Landing,      protected: false },
  { path: '/signin',  element: SignIn,        protected: false },
  { path: '/map',     element: MapPage,       protected: true, icon: <Map className="h-4 w-4" />, label: 'Map',         showInNav: true },
  { path: '/account', element: UserAccount,   protected: true, label: 'Account' },
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
