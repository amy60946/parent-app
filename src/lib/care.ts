import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  ClinicLink, CareGoal, CareModule, PendingInvite, Suggestion, carePlan, listLinks, pendingInvites, pendingSuggestions, todayLogs,
} from './clinic';
import { todayISO } from '../dates';

// Uzman ilişkisinin özeti (Ben ve Uzmanım sekmeleri; kullanıcı isteği 28 Ekim 2026, Joon "Me" / "Care"):
// bağlı uzmanlar (çocuk başına paylaşım), bekleyen davetler, bekleyen görev önerileri, aile programının etkin modülleri ve
// bugün uygulandı mı. Hepsi mevcut ortak işlevlerle (akislar.md 10–12, 5.4); sunucuda işlev yoksa boş döner.
export type CareTodo = { linkId: string; childId: string; clinician: string; module: CareModule; doneToday: boolean };
export type Clinician = { clinicId: string; name: string; clinic: string; title: string; verifiedAs?: string; links: ClinicLink[] };
export type CarePlanData = { goals: CareGoal[]; modules: CareModule[] };
export type CareState = { links: ClinicLink[]; invites: PendingInvite[]; suggestions: Suggestion[]; todos: CareTodo[]; plans: Record<string, CarePlanData> };
const EMPTY: CareState = { links: [], invites: [], suggestions: [], todos: [], plans: {} };

export const clinicianName = (l: Pick<ClinicLink, 'clinician' | 'clinic'>) => l.clinician || l.clinic || 'Uzman';

// Aynı uzman (klinik) birden çok çocukla paylaşılmış olabilir: uzman başına grupla
export function groupClinicians(links: ClinicLink[]): Clinician[] {
  const map = new Map<string, Clinician>();
  for (const l of links) {
    const c = map.get(l.clinicId) ?? { clinicId: l.clinicId, name: clinicianName(l), clinic: l.clinic, title: l.title, verifiedAs: l.verifiedAs, links: [] };
    c.links.push(l);
    map.set(l.clinicId, c);
  }
  return [...map.values()];
}

export async function loadCare(familyId: string | null): Promise<CareState> {
  const links = await listLinks().catch(() => [] as ClinicLink[]);
  const [invites, suggestions, plans] = await Promise.all([
    pendingInvites().catch(() => [] as PendingInvite[]),
    familyId ? pendingSuggestions(familyId).catch(() => [] as Suggestion[]) : Promise.resolve([] as Suggestion[]),
    Promise.all(links.filter((l) => l.planReady).map(async (l) => ({ l, p: await carePlan(l.linkId).catch(() => null) }))),
  ]);
  const active = plans.flatMap(({ l, p }) => (p?.modules ?? []).filter((m) => m.status === 'active')
    .map((m) => ({ linkId: l.linkId, childId: l.childId, clinician: clinicianName(l), module: m })));
  const logs = await todayLogs(active.map((a) => a.module.id), todayISO()).catch(() => []);
  const todos = active.map((a) => ({ ...a, doneToday: logs.some((x) => x.moduleId === a.module.id && x.practiced) }));
  const byLink: Record<string, CarePlanData> = {};
  for (const { l, p } of plans) if (p) byLink[l.linkId] = p;
  return { links, invites, suggestions, todos, plans: byLink };
}

// Ekran her öne geldiğinde yeniden okunur (başka ekranda "Bugün uyguladım" ya da paylaşım değişmiş olabilir)
export function useCare(familyId: string | null) {
  const [state, setState] = useState<CareState | null>(null);
  const reload = useCallback(() => loadCare(familyId).then(setState).catch(() => setState(EMPTY)), [familyId]);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  return { care: state, reload, setCare: setState };
}
