import { createContext, useContext } from 'react';

// İlk kurulumun bitişi (App.tsx → Main sağlar): 'children' çocuk ekledi → cihaz kurulumu; 'joined' eşinin ailesine katıldı.
export type SetupEnd = 'children' | 'joined';
export const SetupCtx = createContext<{ finish: (how: SetupEnd) => void }>({ finish: () => {} });
export const useSetup = () => useContext(SetupCtx);
