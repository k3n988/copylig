// src/app/(dashboard)/layout.tsx
// Shared layout for all main dashboard routes.
// DashboardShell (and MapView inside it) mounts ONCE and persists across tab
// switches — prevents the map from resetting on every navigation.

import DashboardShell from '@/components/layout/DashboardShell'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>
}
