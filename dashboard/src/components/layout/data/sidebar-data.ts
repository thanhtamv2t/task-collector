import {
  Activity,
  CalendarDays,
  FileText,
  LayoutDashboard,
  MessageSquareText,
  Users,
} from 'lucide-react'
import { type SidebarData } from '../types'

export const sidebarData: SidebarData = {
  user: {
    name: 'Admin',
    email: 'Performance Reporter',
    avatar: '',
  },
  teams: [],
  navGroups: [
    {
      title: 'Reporter',
      items: [
        {
          title: 'Overview',
          url: '/',
          icon: LayoutDashboard,
        },
        {
          title: 'Performance',
          url: '/performance',
          icon: CalendarDays,
        },
        {
          title: 'Reports',
          url: '/reports',
          icon: FileText,
        },
        {
          title: 'Groups',
          url: '/groups',
          icon: Users,
        },
        {
          title: 'Messages',
          url: '/messages',
          icon: MessageSquareText,
        },
        {
          title: 'Jobs',
          url: '/jobs',
          icon: Activity,
        },
      ],
    },
  ],
}
