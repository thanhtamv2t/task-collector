import { createFileRoute } from '@tanstack/react-router'
import { DashboardJobs } from '@/features/dashboard'

export const Route = createFileRoute('/_authenticated/jobs')({
  component: DashboardJobs,
})
