import { createFileRoute } from '@tanstack/react-router'
import { DashboardGroups } from '@/features/dashboard'

export const Route = createFileRoute('/_authenticated/groups')({
  component: DashboardGroups,
})
