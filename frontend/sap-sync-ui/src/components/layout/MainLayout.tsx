import { Outlet, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { AppSidebar } from '../sidebar/AppSidebar';
import { flattenRoutes, routes } from '../../routes/routes';
import type { RootState } from '../../app/store';
import { VITE_APP_NAME } from '../../features/config';

export default function MainLayout() {
  const { pathname } = useLocation();
  const token = useSelector((state: RootState) => state.auth.token);
  const pageTitle = flattenRoutes(routes).find((r) => r.path === pathname)?.label ?? VITE_APP_NAME;

  if (!token) return null;

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="sticky top-0 z-[1100] flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/80 backdrop-blur-sm transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
            <span className="font-semibold text-sm">{pageTitle}</span>
          </div>
        </header>
        <Outlet />
      </SidebarInset>
    </SidebarProvider>
  );
}
