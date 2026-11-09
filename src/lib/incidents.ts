import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from './supabase';
import { isMissingRpc } from './clinic';

// Davranış olayı bildir (kullanıcı isteği 9 Kasım 2026: rakibin "Target behaviors & reported incidents" aile ekranlarına sadık;
// ortak akislar.md 24, veritabani.md 33, durumlar.md P22, öneri 20261110110000_target_behaviors.sql). Mevcut "Davranış kaydı"
// (abc.ts, abc_events) ile BİRLEŞTİRİLMEDİ. Uzman ClinicApp'te hedef davranış kurar (kayıt türü: sıklık / ABC / süre);
// ebeveyn olayı bildirir, uzmana behavior_incident bildirimi gider. Sunucuda işlev yoksa null: giriş satırları görünmez.

export type LogType = 'frequency' | 'abc' | 'duration';
export type TargetBehavior = { id: string; title: string; description: string; strategies: string[]; logType: LogType };
export type BehaviorLink = { linkId: string; childId: string; childName: string; clinicId: string; behaviors: TargetBehavior[] };
// Çocuğun tepkisi: ebeveynin gözlemi, puan değil (durumlar.md P22)
export const RESPONSES = [
  { value: 1, label: 'Kötü' }, { value: 2, label: 'Zayıf' }, { value: 3, label: 'Orta' }, { value: 4, label: 'İyi' }, { value: 5, label: 'Çok iyi' },
];

export async function familyTargetBehaviors(): Promise<BehaviorLink[] | null> {
  const { data, error } = await supabase.rpc('family_target_behaviors');
  if (error) { if (isMissingRpc(error)) return null; throw new Error(error.message); }
  return ((data ?? []) as any[]).map((l) => ({
    linkId: l.link_id, childId: l.child_id, childName: l.child_name ?? '', clinicId: l.clinic_id,
    behaviors: (l.behaviors ?? []).map((b: any) => ({ id: b.id, title: b.title, description: b.description ?? '',
      strategies: Array.isArray(b.strategies) ? b.strategies.filter((x: unknown) => typeof x === 'string' && x.trim()) : [], logType: b.log_type })),
  }));
}

export type IncidentInput = {
  linkId: string; behaviorId?: string; occurredAt: string; count?: number; durationMin?: number;
  antecedent?: string; consequence?: string; strategy?: string; response?: number; otherBehavior?: string;
};
export async function reportIncident(v: IncidentInput): Promise<string> {
  const { data, error } = await supabase.rpc('family_incident_report', {
    p_link: v.linkId, p_behavior: v.behaviorId ?? null, p_occurred_at: v.occurredAt, p_count: v.count ?? null,
    p_duration_min: v.durationMin ?? null, p_antecedent: v.antecedent ?? '', p_consequence: v.consequence ?? '',
    p_strategy: v.strategy ?? '', p_response: v.response ?? null, p_other_behavior: v.otherBehavior ?? '',
  });
  if (error) throw new Error(error.message);
  return data as string;
}

export function incidentError(e: unknown): string {
  const m = (e as Error | undefined)?.message ?? '';
  if (/link_not_found/.test(m)) return 'Bu çocuğun uzmanla paylaşımı açık değil.';
  if (/behavior_not_found/.test(m)) return 'Uzmanın bu davranışı listeden kaldırmış. Geri dönüp yeniden seç.';
  if (/date_out_of_range/.test(m)) return 'Olay tarihi bugünden ileri ya da 30 günden eski olamaz.';
  if (/count_required/.test(m)) return 'Kaç kez olduğunu yaz.';
  if (/abc_required/.test(m)) return 'Olaydan önce ve sonra ne olduğunu yaz.';
  if (/duration_required/.test(m)) return 'Ne kadar sürdüğünü yaz.';
  if (/behavior_required/.test(m)) return 'Ne olduğunu yaz.';
  return 'Şu an gönderilemedi. İnternet bağlantını kontrol edip tekrar dene.';
}

// Ekran öne geldikçe okunur. null = sunucuda yok, undefined = yükleniyor.
export function useTargetBehaviors() {
  const [list, setList] = useState<BehaviorLink[] | null | undefined>(undefined);
  useFocusEffect(useCallback(() => {
    let live = true;
    familyTargetBehaviors().then((v) => { if (live) setList(v); }).catch(() => { if (live) setList((x) => x ?? []); });
    return () => { live = false; };
  }, []));
  return list;
}
// Olay bildirilebilecek paylaşımlar: uzmanın ebeveyn kaydını açtığı en az bir hedef davranış (yoksa giriş satırı görünmez)
export const reportable = (list: BehaviorLink[] | null | undefined) => (list ?? []).filter((l) => l.behaviors.length > 0);
