import * as React from 'react';
import { Link } from 'react-router-dom';
import { Database } from 'lucide-react';
import { NavMain } from './NavMain';
import { NavUser } from './NavUser';
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail,
} from '@/components/ui/sidebar';
import { VITE_APP_NAME } from '../../features/config';
import { routes } from '../../routes/routes';

const navItems = routes
  .filter((r) => r.showInNav)
  .map((r) => ({
    title: r.label ?? r.path,
    url: r.path,
    icon: r.icon,
    items: r.children
      ?.filter((c) => c.showInNav)
      .map((c) => ({ title: c.label ?? c.path, url: c.path, icon: c.icon })),
  }));

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/logs/jobs">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Database className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{VITE_APP_NAME}</span>
                  <span className="truncate text-xs text-muted-foreground">SAP B1 Sync</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navItems} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
