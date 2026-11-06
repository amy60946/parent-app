import AsyncStorage from '@react-native-async-storage/async-storage';

// Giriş ekranında girilen davet kodu: kayıt/giriş tamamlanınca aileye otomatik katılım için saklanır.
const KEY = 'pending-invite';
export const normalizeCode = (v: string) => v.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, 6);
export const setPendingInvite = (code: string) => AsyncStorage.setItem(KEY, code);
export const getPendingInvite = () => AsyncStorage.getItem(KEY);
export const clearPendingInvite = () => AsyncStorage.removeItem(KEY);
