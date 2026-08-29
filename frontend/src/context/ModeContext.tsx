import React, { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';


export type Mode = 'eli5' | 'tech';

interface ModeContextValue {
  mode: Mode;
  setMode: (m: Mode) => void;
  t: (eli5: string, tech: string) => string;
}

const ModeContext = createContext<ModeContextValue>({
  mode: 'eli5',
  setMode: () => {},
  t: (eli5) => eli5,
});

export const ModeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [mode, setMode] = useState<Mode>('eli5');
  const t = (eli5: string, tech: string) => (mode === 'eli5' ? eli5 : tech);
  return (
    <ModeContext.Provider value={{ mode, setMode, t }}>
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => useContext(ModeContext);
