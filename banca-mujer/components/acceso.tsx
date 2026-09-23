'use client';
// Comparte con las cards los scopes que el canal tiene en cada reino (se calculan en el servidor)
import { createContext, useContext, type ReactNode } from 'react';
import type { Access } from '@/lib/access';

const AccessContext = createContext<Access | undefined>(undefined);

export function AccesoProvider({ access, children }: { access: Access; children: ReactNode }) {
  return <AccessContext.Provider value={access}>{children}</AccessContext.Provider>;
}

export const useAccess = () => useContext(AccessContext);
