// Sunucu hatası + nedeni (hint). Kod ve abonelik hataları: ortak/sozlesme/durumlar.md 11–12.
export class AppError extends Error {
  hint?: string;
  constructor(message: string, hint?: string | null) {
    super(message);
    this.hint = hint ?? undefined;
  }
}

export const toAppError = (e: { message: string; hint?: string | null }) => new AppError(e.message, e.hint);

export const fail = (e: { message: string; hint?: string | null } | null) => {
  if (e) throw toAppError(e);
};

export const hintOf = (e: unknown) => (e as AppError | undefined)?.hint;

// Ekranda gösterilecek hata metni (güvenlik denetimi 22 Kasım 2026, ortak DURUM): bizim sunucu işlevlerimizin bilerek
// yazdığı Türkçe metin olduğu gibi gösterilir; tablo, kısıt, tetikleyici adı ya da İngilizce sunucu / kütüphane metni
// ekrana çıkmaz, tek genel metne düşer. Ham metin yalnız hata ayıklamada (console) kalır.
export const GENERIC_ERROR = 'Bir şeyler ters gitti. Biraz sonra tekrar dene.';
const NETWORK = /network|failed to fetch|fetch failed|timed? ?out|offline/i;
const LETTERS = /[çğıöşüÇĞİÖŞÜ]/; // i bayrağı yok: İngilizce "i/I" Türkçe harf sayılmasın
const WORDS = /(^|[^a-zçğıöşü])(yok|gerekli|verdi|zaten|hesap|kod|kodu|davet|aile|oturum|yetki|yetkisiz|belge|seferde)([^a-zçğıöşü]|$)/i;
const TECHNICAL = /_|\b(relation|constraint|column|table|function|violates|permission denied|duplicate key|syntax|jwt|pgrst|schema|null value|foreign key|trigger|row-level|policy|uuid|invalid input|sqlstate|bucket)\b/i;
export function errorText(e: unknown, fallback = GENERIC_ERROR): string {
  const m = typeof e === 'string' ? e : (e as { message?: unknown } | null | undefined)?.message;
  if (typeof m !== 'string' || !m.trim()) return fallback;
  if (NETWORK.test(m)) return 'İnternet bağlantını kontrol et ve tekrar dene.';
  if ((LETTERS.test(m) || WORDS.test(m)) && !TECHNICAL.test(m) && m.length <= 300) return m.trim();
  if (__DEV__) console.warn('Gösterilmeyen hata metni:', m);
  return fallback;
}
