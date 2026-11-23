import { supabase } from './supabase';
import { isMissingRpc } from './clinic';
import { AppError } from './errors';

// Uzmandan gelen raporlar (kullanıcı kararları 23 Kasım 2026; ortak öneri 20261123100000_mercek_updates):
// uzman Moyo Mercek'te "Ebeveyne gönder" der, ebeveyne report_shared bildirimi gider. Rapor uygulama içi sayfa olarak
// açılır (PDF değil); arşiv yalnız çocuğun Gelişim sayfasında (Moyo penceresinde kullanıcı seçimi). Paylaşım bitse de
// rapor ailede kalır. Liste içerik taşımaz; içerik family_report ile, ilk açılışta "görüldü" yazılır.
export type ReportRow = {
  id: string; childId: string | null; childName: string; title: string; clinicianName: string;
  periodStart: string | null; periodEnd: string | null; createdAt: string; seenAt: string | null;
};

// İçerik şeması v1 (ortak report_content_check ile aynı): tanınmayan bölüm türü atlanır
export type ReportSection =
  | { type: 'text'; title?: string; body: string }
  | { type: 'kv'; title?: string; rows: [string, string][] }
  | { type: 'table'; title?: string; columns: string[]; rows: string[][] }
  | { type: 'list'; title?: string; items: string[] };
export type ReportContent = { v: number; childName?: string; period?: { start?: string; end?: string }; sections: ReportSection[]; footer?: string };
export type Report = ReportRow & { content: ReportContent | null };

const toRow = (r: any): ReportRow => ({
  id: r.id, childId: r.child_id ?? null, childName: r.child_name ?? '', title: r.title ?? '', clinicianName: r.clinician_name ?? '',
  periodStart: r.period_start ?? null, periodEnd: r.period_end ?? null, createdAt: r.created_at, seenAt: r.seen_at ?? null,
});

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const strs = (v: unknown) => (Array.isArray(v) ? v.map(str) : []);

function toContent(c: any): ReportContent | null {
  if (!c || typeof c !== 'object' || typeof c.v !== 'number') return null;
  const sections: ReportSection[] = [];
  for (const s of Array.isArray(c.sections) ? c.sections : []) {
    const title = str(s?.title) || undefined;
    if (s?.type === 'text') sections.push({ type: 'text', title, body: str(s.body) });
    else if (s?.type === 'kv') sections.push({ type: 'kv', title, rows: (Array.isArray(s.rows) ? s.rows : []).map((r: unknown) => strs(r)).filter((r: string[]) => r.length === 2) as [string, string][] });
    else if (s?.type === 'table') sections.push({ type: 'table', title, columns: strs(s.columns), rows: (Array.isArray(s.rows) ? s.rows : []).map((r: unknown) => strs(r)) });
    else if (s?.type === 'list') sections.push({ type: 'list', title, items: strs(s.items) });
  }
  return { v: c.v, childName: str(c.child?.name) || undefined, period: c.period ? { start: str(c.period.start) || undefined, end: str(c.period.end) || undefined } : undefined,
    sections, footer: str(c.footer) || undefined };
}

// null: sunucuda işlev yok (öneri uygulanmadı): bölüm görünmez
export async function familyReports(childId?: string): Promise<ReportRow[] | null> {
  const { data, error } = await supabase.rpc('family_reports', childId ? { p_child: childId } : {});
  if (error) { if (isMissingRpc(error)) return null; throw new AppError(error.message, error.hint); }
  return ((data ?? []) as any[]).map(toRow);
}

export async function familyReport(id: string): Promise<Report> {
  const { data, error } = await supabase.rpc('family_report', { p_id: id });
  if (error) throw new AppError(error.message, error.hint);
  return { ...toRow(data), content: toContent((data as any)?.content) };
}
