'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface UserSettings {
  tickerSpeed: number; // in seconds
  setTickerSpeed: (speed: number) => void;
  appDesignerMode: boolean;
  setAppDesignerMode: (mode: boolean) => void;
}

const UserSettingsContext = createContext<UserSettings>({
  tickerSpeed: 120,
  setTickerSpeed: () => {},
  appDesignerMode: false,
  setAppDesignerMode: () => {},
});

export function UserSettingsProvider({ children }: { children: React.ReactNode }) {
  const [tickerSpeed, setTickerSpeed] = useState(120);
  const [appDesignerMode, setAppDesignerMode] = useState(false);

  // Load from local storage on mount
  useEffect(() => {
    const savedSpeed = localStorage.getItem('mfo_tickerSpeed');
    if (savedSpeed) setTickerSpeed(parseInt(savedSpeed, 10));
    
    const savedDesignerMode = localStorage.getItem('mfo_appDesignerMode');
    if (savedDesignerMode) setAppDesignerMode(savedDesignerMode === 'true');
  }, []);

  const handleSetTickerSpeed = (speed: number) => {
    setTickerSpeed(speed);
    localStorage.setItem('mfo_tickerSpeed', speed.toString());
  };

  const handleSetAppDesignerMode = (mode: boolean) => {
    setAppDesignerMode(mode);
    localStorage.setItem('mfo_appDesignerMode', mode.toString());
  };

  return (
    <UserSettingsContext.Provider value={{ 
      tickerSpeed, setTickerSpeed: handleSetTickerSpeed,
      appDesignerMode, setAppDesignerMode: handleSetAppDesignerMode
    }}>
      {children}
    </UserSettingsContext.Provider>
  );
}

export const useUserSettings = () => useContext(UserSettingsContext);
