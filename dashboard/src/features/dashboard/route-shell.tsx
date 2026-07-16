import { AuthenticatedLayout } from '@/components/layout/authenticated-layout'
import { DashboardShell } from '@/features/dashboard'

export function DashboardRouteShell() {
  return (
    <AuthenticatedLayout>
      <DashboardShell />
    </AuthenticatedLayout>
  )
}
