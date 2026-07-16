import { createFileRoute } from '@tanstack/react-router'
import { DashboardOverview } from '@/features/dashboard'

export const Route = createFileRoute('/_authenticated/')({
  component: DashboardOverview,
})
