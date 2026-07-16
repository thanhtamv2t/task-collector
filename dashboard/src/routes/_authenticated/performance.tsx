import { createFileRoute } from '@tanstack/react-router'
import { DashboardPerformance } from '@/features/dashboard'

export const Route = createFileRoute('/_authenticated/performance')({
  component: DashboardPerformance,
})
