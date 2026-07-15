'use client';

import { createContext, useContext, type ReactNode } from 'react';

import {
  UNRESTRICTED_WORKSPACE_ACTION_ACCESS,
  type WorkspaceActionAccess,
} from '@/lib/saas/workspace-action-access';

const WorkspaceAccessContext = createContext<WorkspaceActionAccess>(
  UNRESTRICTED_WORKSPACE_ACTION_ACCESS
);

export function WorkspaceAccessProvider({
  access,
  children,
}: {
  access: WorkspaceActionAccess;
  children: ReactNode;
}) {
  return (
    <WorkspaceAccessContext.Provider value={access}>
      {children}
    </WorkspaceAccessContext.Provider>
  );
}

export function useWorkspaceAccess(): WorkspaceActionAccess {
  return useContext(WorkspaceAccessContext);
}
