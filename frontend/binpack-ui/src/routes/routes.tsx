import type { ComponentType } from 'react';
import SignIn from '../pages/SignIn';
import BinpackPage from '../pages/BinpackPage';

export interface RouteConfig {
  path: string;
  element?: ComponentType;
  protected: boolean;
}

export const routes: RouteConfig[] = [
  { path: '/',        element: SignIn,      protected: false },
  { path: '/signin',  element: SignIn,      protected: false },
  { path: '/binpack', element: BinpackPage, protected: true  },
];

export function flattenRoutes(list: RouteConfig[]): (RouteConfig & { element: ComponentType })[] {
  return list.filter((r): r is RouteConfig & { element: ComponentType } => !!r.element);
}
