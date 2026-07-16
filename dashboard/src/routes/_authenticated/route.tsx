import { createFileRoute } from '@tanstack/react-router'
import { DashboardRouteShell } from '@/features/dashboard/route-shell'

export const Route = createFileRoute('/_authenticated')({
  component: DashboardRouteShell,
})
