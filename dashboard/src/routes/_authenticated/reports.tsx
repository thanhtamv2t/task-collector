import { createFileRoute } from '@tanstack/react-router'
import { DashboardReports } from '@/features/dashboard'

export const Route = createFileRoute('/_authenticated/reports')({
  component: DashboardReports,
})
