import { supabase } from './supabase';
import { fail } from './errors';

// Güneş Taşı ve gerçek ödüller: ortak/supabase/proposed/20261021160000_sun_stones_rewards.sql
// Taş yalnız onaylanan görevden gelir (kolay 1 / orta 2 / zor 3); ödül verilince ya da ebeveyn düşünce azalır.
export type Reward = { id: string; title: string; cost: number; childId?: string; active: boolean };
export type RewardRequest = {
  id: string; childId: string; rewardId?: string; title: string; cost: number;
  source: 'child' | 'parent'; status: 'pending' | 'approved' | 'rejected' | 'canceled'; note?: string; createdAt: string;
};
export type StoneMove = { id: number; childId: string; amount: number; reason: 'task' | 'task_undo' | 'reward' | 'penalty' | 'adjust'; note?: string; at: string };

export async function listRewards(familyId: string): Promise<Reward[]> {
  const { data, error } = await supabase.from('rewards').select('*').eq('family_id', familyId).order('created_at');
  fail(error);
  return (data ?? []).filter((r: any) => r.active !== false)
    .map((r: any) => ({ id: r.id, title: r.title, cost: r.cost, childId: r.child_id ?? undefined, active: r.active !== false }))
    .sort((a, b) => a.cost - b.cost);
}

export async function saveReward(familyId: string, r: { id?: string; title: string; cost: number; childId?: string }) {
  const row = { title: r.title.trim(), cost: r.cost, child_id: r.childId ?? null };
  const { error } = r.id
    ? await supabase.from('rewards').update(row).eq('id', r.id)
    : await supabase.from('rewards').insert({ ...row, family_id: familyId });
  fail(error);
}

export async function deleteReward(id: string) {
  const { error } = await supabase.from('rewards').delete().eq('id', id);
  fail(error);
}

export async function balances(childIds: string[]): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  await Promise.all(childIds.map(async (id) => {
    const { data, error } = await supabase.rpc('sun_stone_balance', { p_child_id: id });
    fail(error);
    out[id] = Number(data ?? 0);
  }));
  return out;
}

export async function history(familyId: string): Promise<StoneMove[]> {
  const { data, error } = await supabase.from('sun_stone_ledger').select('*').eq('family_id', familyId)
    .order('created_at', { ascending: false }).limit(200);
  fail(error);
  return (data ?? []).map((r: any) => ({ id: r.id, childId: r.child_id, amount: r.amount, reason: r.reason, note: r.note ?? undefined, at: r.created_at }))
    .sort((a, b) => b.at.localeCompare(a.at));
}

export async function requests(familyId: string): Promise<RewardRequest[]> {
  const { data, error } = await supabase.from('reward_requests').select('*').eq('family_id', familyId)
    .order('created_at', { ascending: false }).limit(100);
  fail(error);
  return (data ?? []).map((r: any) => ({
    id: r.id, childId: r.child_id, rewardId: r.reward_id ?? undefined, title: r.title, cost: r.cost, source: r.source,
    status: r.status, note: r.note ?? undefined, createdAt: r.created_at,
  })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function giveReward(childId: string, rewardId: string) {
  const { error } = await supabase.rpc('give_reward', { p_child_id: childId, p_reward_id: rewardId });
  fail(error);
}

export async function deductStones(childId: string, amount: number, note: string) {
  const { error } = await supabase.rpc('deduct_sun_stones', { p_child_id: childId, p_amount: amount, p_note: note.trim() || null });
  fail(error);
}

export async function decideRequest(id: string, approve: boolean, note?: string) {
  const { error } = await supabase.rpc('decide_reward_request', { p_request_id: id, p_approve: approve, p_note: note?.trim() || null });
  fail(error);
}

export const moveLabel: Record<StoneMove['reason'], string> = {
  task: 'Görev onaylandı', task_undo: 'Onay geri alındı', reward: 'Ödül', penalty: 'Taş düşüldü', adjust: 'Düzeltme',
};
