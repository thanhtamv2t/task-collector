import { createFileRoute } from '@tanstack/react-router'
import { DashboardMessages } from '@/features/dashboard'

export const Route = createFileRoute('/_authenticated/messages')({
  component: DashboardMessages,
})
