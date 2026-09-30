import { lazy } from 'react';

// This is the only import path into development-only controls and wording.
export const loadOwnerPanel = import.meta.env.DEV ? lazy(() => import('./dev/OwnerPanel.tsx')) : null;
