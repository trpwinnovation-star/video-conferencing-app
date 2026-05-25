"use client";

import React, { createContext, useContext, useState, useCallback } from "react";

interface RoomPinContextType {
  pinnedIdentity: string | null;
  pinParticipant: (identity: string) => void;
  unpinParticipant: () => void;
  togglePin: (identity: string) => void;
}

const RoomPinContext = createContext<RoomPinContextType | null>(null);

export function RoomPinProvider({ children }: { children: React.ReactNode }) {
  const [pinnedIdentity, setPinnedIdentity] = useState<string | null>(null);

  const pinParticipant = useCallback((identity: string) => {
    setPinnedIdentity(identity);
  }, []);

  const unpinParticipant = useCallback(() => {
    setPinnedIdentity(null);
  }, []);

  const togglePin = useCallback((identity: string) => {
    setPinnedIdentity((prev) => (prev === identity ? null : identity));
  }, []);

  return (
    <RoomPinContext.Provider
      value={{ pinnedIdentity, pinParticipant, unpinParticipant, togglePin }}
    >
      {children}
    </RoomPinContext.Provider>
  );
}

export function useRoomPin() {
  const ctx = useContext(RoomPinContext);
  if (!ctx) {
    throw new Error("useRoomPin must be used within RoomPinProvider");
  }
  return ctx;
}
