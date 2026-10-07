import { Link, useRouterState } from '@tanstack/react-router'
import {
  RiDashboardLine,
  RiPriceTag3Line,
  RiShoppingBag3Line,
  type RemixiconComponentType,
} from '@remixicon/react'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const NAV: { to: '/' | '/products' | '/categories'; label: string; icon: RemixiconComponentType }[] = [
  { to: '/', label: 'Нүүр', icon: RiDashboardLine },
  { to: '/products', label: 'Бараа', icon: RiShoppingBag3Line },
  { to: '/categories', label: 'Ангилал', icon: RiPriceTag3Line },
]

/**
 * The dashboard only on its own path; any other section also for the pages
 * under it — a variant page belongs to the products it is part of.
 */
function isActivePath(pathname: string, to: string) {
  if (to === '/') return pathname === '/'
  if (to === '/products' && pathname.startsWith('/variants/')) return true
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AppSidebar() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          to="/"
          className="flex h-10 items-center gap-2 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <span className="font-heading text-lg font-bold tracking-tight">38</span>
          <span className="font-heading text-sm font-semibold tracking-widest uppercase group-data-[collapsible=icon]:hidden">
            Shop 38 админ
          </span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    isActive={isActivePath(pathname, item.to)}
                    tooltip={item.label}
                    render={<Link to={item.to} />}
                  >
                    <item.icon />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <div className="truncate px-2 text-xs text-muted-foreground group-data-[collapsible=icon]:hidden">
          admin@shop38.com
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
