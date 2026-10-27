import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabase';

// İlk onay kutlaması (kullanıcı isteği 27 Ekim 2026): bu ebeveynin sunucudaki ilk onayıysa bir kez.
// Cihazda bir kez sorulur; başka cihazda daha önce onay verdiyse sayı 1'i geçer ve gösterilmez.
const KEY = 'first-approval-seen';
export async function isFirstApproval(): Promise<boolean> {
  if (await AsyncStorage.getItem(KEY)) return false;
  await AsyncStorage.setItem(KEY, '1');
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return false;
  const { count, error } = await supabase.from('completions').select('id', { count: 'exact', head: true })
    .eq('status', 'approved').eq('reviewed_by', uid);
  return !error && (count ?? 0) <= 1;
}
