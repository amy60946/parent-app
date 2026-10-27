// Aile aboneliği planları. Fiyatlar YER TUTUCU: canlıda fiyat ve para birimi App Store'dan (ödeme sağlayıcısı) gelir.
// Ürün kimlikleri sunucuyla aynı (ortak/sozlesme/durumlar.md 12).
export type PlanId = 'monthly' | 'yearly';

export const plans: Record<PlanId, { productId: string; title: string; price: string; period: string; note: string; badge?: string }> = {
  yearly: {
    productId: 'parentapp.premium.yearly',
    title: 'Yıllık',
    price: '₺1.199,99',
    period: 'yıl',
    note: 'Tek seferde peşin ödenir · ayda ₺99,99\'a gelir',
    badge: '%33 avantajlı',
  },
  monthly: {
    productId: 'parentapp.premium.monthly',
    title: 'Aylık',
    price: '₺149,99',
    period: 'ay',
    note: 'Her ay yenilenir · istediğin zaman iptal et',
  },
};

export const premiumFeatures = [
  'Sınırsız görev ve çocuk',
  'Ödüller ve Güneş Taşı',
  'Çocuğunla mesajlaşma',
  'Gözlem notları (sesli) ve arşiv',
  'İki ebeveyn aynı üyelikle',
];

// hukuk/50 §6.1 "Şimdilik ücretsiz devam et" notu
export const freeFeatures = 'Ücretsiz planda 1 çocuk ve 3 etkin görevle devam edersin; ödüller, mesajlar ve gözlem notları kapalıdır. Oyun ve uzman paylaşımı çalışmaya devam eder.';
