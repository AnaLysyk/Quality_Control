"use client";

import {
  createContext,
  useContext,
  useEffect,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";

const AppShellCoverSlotContext = createContext<Dispatch<SetStateAction<ReactNode | null>> | null>(null);

type AppShellCoverSlotProviderProps = {
  children: ReactNode;
  setCoverSlot: Dispatch<SetStateAction<ReactNode | null>>;
};

export function AppShellCoverSlotProvider({ children, setCoverSlot }: AppShellCoverSlotProviderProps) {
  return (
    <AppShellCoverSlotContext.Provider value={setCoverSlot}>
      {children}
    </AppShellCoverSlotContext.Provider>
  );
}

export function useAppShellCoverSlot(content: ReactNode | null) {
  const setCoverSlot = useContext(AppShellCoverSlotContext);

  useEffect(() => {
    if (!setCoverSlot) return;
    setCoverSlot(content);

    return () => setCoverSlot(null);
  }, [content, setCoverSlot]);
}
