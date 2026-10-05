import { useEffect } from 'react'
import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet, useRouterState } from '@tanstack/react-router'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: RootLayout,
})

/**
 * No breadcrumb bar: every page names itself in its own header, with a back link
 * where it has a parent. The sidebar is the only chrome.
 */
function RootLayout() {
  const pathname = useRouterState({ select: (state) => state.location.pathname })

  return (
    <SidebarProvider>
      <CloseOnNavigate pathname={pathname} />
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4 md:hidden">
          <SidebarTrigger />
          <span className="font-heading text-sm font-semibold tracking-widest uppercase">
            Shop 38 админ
          </span>
        </header>
        <div className="hidden p-2 md:block">
          <SidebarTrigger />
        </div>
        <main className="mx-auto w-full max-w-6xl px-4 pb-16 md:px-8">
          <Outlet />
        </main>
      </SidebarInset>
      <Toaster position="bottom-right" />
      {import.meta.env.DEV && <ReactQueryDevtools buttonPosition="bottom-right" />}
    </SidebarProvider>
  )
}

/** On a phone the sidebar is a sheet over the page; picking a page closes it. */
function CloseOnNavigate({ pathname }: { pathname: string }) {
  const { setOpenMobile } = useSidebar()
  useEffect(() => setOpenMobile(false), [pathname, setOpenMobile])
  return null
}
