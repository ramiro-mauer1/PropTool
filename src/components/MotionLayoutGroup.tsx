'use client';

import { LayoutGroup } from 'framer-motion';

// Scopes shared layoutId animations (the Plinth logo flying from the login
// view into the sidebar) across components that are never simultaneously
// mounted — LoginView unmounts before the app shell mounts, so framer-motion
// needs this group to remember the logo's last position across that swap.
export function MotionLayoutGroup({ children }: { children: React.ReactNode }) {
  return <LayoutGroup>{children}</LayoutGroup>;
}
