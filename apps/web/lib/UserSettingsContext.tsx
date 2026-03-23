'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface UserSettings {
  tickerSpeed: number; // in seconds
  setTickerSpeed: (speed: number) => void;
}

const UserSettingsContext = createContext<UserSettings>({
  tickerSpeed: 120,
  setTickerSpeed: () => {},
});

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [tickerSpeed, setTickerSpeed] = useState(120);

  // Load from local storage on mount
  useEffect(() => {
    const saved = localStorage.getItem('mfo_tickerSpeed');
    if (saved) {
      setTickerSpeed(parseInt(saved, 10));
    }
  }, []);

  const handleSetTickerSpeed = (speed: number) => {
    setTickerSpeed(speed);
    localStorage.setItem('mfo_tickerSpeed', speed.toString());
  };

  return (
    <UserSettingsContext.Provider value={{ tickerSpeed, setTickerSpeed: handleSetTickerSpeed }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export const useUserSettings = () => useContext(UserSettingsContext);
