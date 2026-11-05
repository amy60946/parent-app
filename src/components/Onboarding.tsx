import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, useWindowDimensions, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';
import { track } from '../lib/track';
import { Avatar as Face } from './ui';
import { useParentTasks } from '../parentTasks';

// İlk kullanım rehberi (kullanıcı onayı 26 Ekim 2026, tasarım G1 "numaralı dokunuş yolu"):
// gerçek ekranın sade kopyası karartılır, dokunulacak yerler altın halka + 1 → 2 → 3 sırasıyla gösterilir.
// Tasarım 390×844 noktada çizildi; ekrana sığacak kadar ölçeklenir, alta (sekme çubuğuna) hizalanır.
// 3 Kasım 2026 (kullanıcı kararı; benchmark: kısa turlar ve kullanıcının kendi açtığı turlar çok daha çok bitiriliyor,
// NN/g: sunum tipi turlar görev başarısını artırmıyor): kendiliğinden açılınca önce sorulur ("Göster / Şimdi değil"),
// sonra KISA tur (2 kart: görev ver → onayla; çocuğun oyunda 'Yaptım'a basması onay kartında yazıyla). Aile › Hesap › "Nasıl kullanılır?" TAM turu açar
// (+ ödüller, mesajlar, gelişim, sen de katıl, uzmanım). Çocuk ekleme ve oyuna bağlama Ben'deki "İlk adımlar" kartında.

const KEY = 'onboarding-v1';
const W = 390;
const H = 844;
const GOLD = colors.gold;
const HALO = 'rgba(233,178,43,0.3)';
const DIM = 'rgba(15,27,61,0.62)';
// Açık zemin (#F5F6F8) üstünde karartmanın görünen rengi: ölçeklenen sahnenin dışındaki boşluk
const DIM_SOLID = '#666E84';

type StepId = 'task' | 'review' | 'rewards' | 'chat' | 'progress' | 'parent' | 'clinic' | 'rEarn' | 'rAdd' | 'rGive';
// rewards: Ödüller ekranının ilk açılışı ve ⓘ (kullanıcı isteği 3 Kasım 2026: uzun açıklama yerine aynı "kullanıyormuş gibi" kartlar)
export type GuideMode = 'short' | 'full' | 'rewards';
const STEPS: Record<GuideMode, StepId[]> = {
  // Oyun içi görsel adım (play) çıkarıldı (kullanıcı isteği 5 Kasım 2026); oyundaki 'Yaptım' onay kartının metninde anlatılır
  short: ['task', 'review'],
  full: ['task', 'review', 'rewards', 'chat', 'progress', 'parent', 'clinic'],
  rewards: ['rEarn', 'rAdd', 'rGive'],
};

export async function shouldShowOnboarding(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) !== '1'; } catch { return false; }
}

export async function markOnboardingSeen() {
  try { await AsyncStorage.setItem(KEY, '1'); } catch { /* yalnız bu cihazda hatırlanır */ }
}

// mode: short (kendiliğinden, kurulumdan sonra) | full (elle, "Nasıl kullanılır?"). ask: önce "Göster / Şimdi değil".
// "Sen de katıl" sunucuda ebeveyn görevleri yoksa atlanır.
export default function Onboarding({ visible, onClose, mode = 'full', ask = false }: { visible: boolean; onClose: () => void; mode?: GuideMode; ask?: boolean }) {
  const pt = useParentTasks();
  const steps = STEPS[mode].filter((n) => n !== 'parent' || pt.ready);
  const [step, setStep] = useState(0);
  const [asking, setAsking] = useState(ask);
  const { width, height } = useWindowDimensions();
  const s = Math.min(width / W, height / H);
  React.useEffect(() => {
    if (!visible) return;
    setStep(0);
    setAsking(ask);
    if (!ask) track('onboarding.start', { mode });
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const seen = () => { if (mode !== 'rewards') markOnboardingSeen(); };
  const finish = (done: boolean) => {
    track(done ? 'onboarding.done' : 'onboarding.skip', done ? { mode } : { mode, step: step + 1 });
    seen();
    onClose();
  };
  const later = () => { track('onboarding.later', { mode }); seen(); onClose(); };
  const show = () => { track('onboarding.start', { mode }); setAsking(false); };
  const total = steps.length;
  const next = () => (step < total - 1 ? setStep(step + 1) : finish(true));
  const Step = SCENES[steps[step] ?? 'task'];

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent onRequestClose={() => (asking ? later() : finish(false))}>
      <View style={{ flex: 1, backgroundColor: DIM_SOLID, justifyContent: 'flex-end', alignItems: 'center' }}>
        <View style={{ width: W * s, height: H * s }}>
          <View style={{ position: 'absolute', left: (W * s - W) / 2, top: (H * s - H) / 2, width: W, height: H, transform: [{ scale: s }], overflow: 'hidden', backgroundColor: '#F5F6F8' }}>
            {asking ? <Ask total={total} onShow={show} onLater={later} />
              : <Step step={step} total={total} onNext={next} onBack={step > 0 ? () => setStep(step - 1) : undefined} onSkip={() => finish(false)} />}
          </View>
        </View>
      </View>
    </Modal>
  );
}

// onBack: önceki karta dön (ilk kartta yok; kullanıcı isteği 3 Kasım 2026)
type StepProps = { step: number; total: number; onNext: () => void; onBack?: () => void; onSkip: () => void };

/* ---------- ortak parçalar ---------- */

function Dim() {
  return <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: DIM }]} />;
}

function Trail({ d }: { d: string }) {
  return (
    <Svg width={W} height={H} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path d={d} fill="none" stroke={GOLD} strokeWidth={3} strokeDasharray="7 7" strokeLinecap="round" />
    </Svg>
  );
}

// Altın halkalı öğe: dışta yumuşak hale (12), içte altın çizgi (4), üstte öğenin kendisi + numara rozeti.
function Ring({ style, radius, badge, badgeAt, inner, children }: {
  style: StyleProp<ViewStyle>; radius: number; badge?: number; badgeAt?: ViewStyle; inner?: StyleProp<ViewStyle>; children?: React.ReactNode;
}) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <View style={{ position: 'absolute', left: -12, top: -12, right: -12, bottom: -12, borderRadius: radius + 12, backgroundColor: HALO }} />
      <View style={{ position: 'absolute', left: -4, top: -4, right: -4, bottom: -4, borderRadius: radius + 4, backgroundColor: GOLD }} />
      <View style={[{ flex: 1, borderRadius: radius, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, inner]}>
        {children}
      </View>
      {!!badge && <Badge n={badge} style={badgeAt ?? {}} />}
    </View>
  );
}

function Badge({ n, style }: { n: number; style: ViewStyle }) {
  return (
    <View style={[{ position: 'absolute', width: 26, height: 26, borderRadius: 13, backgroundColor: GOLD, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Text style={{ fontSize: 13, fontWeight: '800', color: colors.navy }}>{n}</Text>
    </View>
  );
}

// Sekmeler (28 Ekim 2026): Ben · Uzmanım · Görevler · Gelişim · Aile; her biri W/5 = 78 nokta
// Ana sayfa sekmesi "Bugün" (3 Kasım 2026, ev simgesiyle)
const TAB_NAMES = ['Bugün', 'Uzmanım', 'Görevler', 'Gelişim', 'Aile'];
const TAB_ICONS: (keyof typeof Ionicons.glyphMap)[] = ['home-outline', 'briefcase-outline', 'list-outline', 'stats-chart-outline', 'people-outline'];
const TAB_W = W / TAB_NAMES.length;
const tabX = (i: number) => i * TAB_W + TAB_W / 2; // sekmenin ortası

// Alttaki sekme çubuğu; vurgulanacak sekmenin yeri boş bırakılır (Ring onu karartmanın üstüne çizer).
function TabBar({ hide, active }: { hide: number; active?: number }) {
  return (
    <View style={st.tabBar}>
      {TAB_NAMES.map((t, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center' }}>
          {i !== hide && <Text style={[st.tabText, i === active && { color: colors.navy, fontWeight: '800' }]}>{t}</Text>}
        </View>
      ))}
    </View>
  );
}

function TabRing({ index }: { index: number }) {
  return (
    <Ring style={{ left: Math.max(14, Math.min(W - 78, tabX(index) - 32)), bottom: 14, width: 64, height: 60 }} radius={16} badge={1} badgeAt={{ top: -12, left: -10 }}>
      <Ionicons name={TAB_ICONS[index]} size={22} color={colors.navy} />
      {!!TAB_NAMES[index] && <Text style={{ fontSize: 12, fontWeight: '800', color: colors.navy, marginTop: 3 }}>{TAB_NAMES[index]}</Text>}
    </Ring>
  );
}

// Üst satırdaki kişi: gerçek avatar görseli (Okti) + ad
function Person({ x, id, label, labelColor = colors.navy }: { x: number; id: string; label: string; labelColor?: string }) {
  return (
    <View style={{ position: 'absolute', left: x, top: 56, alignItems: 'center', gap: 4 }}>
      <Face id={id} size={54} />
      <Text style={{ fontSize: 11, fontWeight: '600', color: labelColor }}>{label}</Text>
    </View>
  );
}

// Örnek aile: ebeveyn Okti anne, çocuk Nazlı (görseller uygulamadakiyle aynı)
const PARENT_FACE = 'okti_anne_1';
const CHILD_FACE = 'okti_kiz_4';

// Uygulamadaki gibi ortalı sekmeler; hide verilen sekmenin yeri boş kalır (Ring üstüne çizer).
function Segments({ active, hide }: { active?: number; hide?: number }) {
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 146, flexDirection: 'row', justifyContent: 'center', gap: 36 }}>
      {['Genel', 'Mesajlar', 'Hesap'].map((t, i) => (
        <Text key={t} style={{ fontSize: 15, fontWeight: '600', color: i === hide ? 'transparent' : i === active ? colors.navy : colors.muted }}>{t}</Text>
      ))}
    </View>
  );
}

function Block({ top, height, left = 20, right = 20, children, style }: { top: number; height: number; left?: number; right?: number; children?: React.ReactNode; style?: ViewStyle }) {
  return <View style={[{ position: 'absolute', left, right, top, height, borderRadius: 18, backgroundColor: '#fff' }, style]}>{children}</View>;
}

// Açıklama kartı: "n / 5", Atla, başlık, tek satır, noktalar + ileri.
function Coach({ step, total, title, text, note, onNext, onBack, onSkip, style }: StepProps & { title: string; text: string; note?: string; style: ViewStyle }) {
  return (
    <View style={[st.card, style]}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={st.counter}>{step + 1} / {total}</Text>
        <Pressable onPress={onSkip} hitSlop={10} accessibilityRole="button" style={{ height: 32, justifyContent: 'center', paddingHorizontal: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#5B6274' }}>Atla</Text>
        </Pressable>
      </View>
      <Text style={st.title} accessibilityRole="header">{title}</Text>
      <Text style={st.text}>{text}</Text>
      {!!note && <Text style={st.note}>{note}</Text>}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <View style={{ flexDirection: 'row', gap: 5 }} accessible accessibilityLabel={`Adım ${step + 1} / ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={{ width: i === step ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i === step ? colors.navy : '#D5D9E2' }} />
          ))}
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          {onBack && <BackBtn onPress={onBack} />}
          <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel={step === total - 1 ? 'Bitir' : 'İleri'} style={st.next}>
            <Ionicons name={step === total - 1 ? 'checkmark' : 'arrow-forward'} size={20} color="#fff" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function BackBtn({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Geri" style={st.back}>
      <Ionicons name="arrow-back" size={20} color={colors.navy} />
    </Pressable>
  );
}

/* ---------- Görev ver: Görevler → + (hazır rutinler) ---------- */

const WEEK = [['Pzt', '26'], ['Sal', '27'], ['Çar', '28'], ['Per', '29'], ['Cum', '30'], ['Cmt', '31'], ['Paz', '1']];

function Chips({ top, on }: { top: number; on: 'all' | 'me' }) {
  return (
    <View style={{ position: 'absolute', left: 20, top, flexDirection: 'row', gap: 8 }}>
      <View style={[st.fchip, on === 'all' && st.fchipOn]}><Text style={[st.fchipText, on === 'all' && { color: '#fff' }]}>Tümü</Text></View>
      <View style={[st.fchip, on === 'me' && st.fchipOn]}><Face id={PARENT_FACE} size={22} /><Text style={[st.fchipText, on === 'me' && { color: '#fff' }]}>Ben</Text></View>
      <View style={st.fchip}><Face id={CHILD_FACE} size={22} /><Text style={st.fchipText}>Nazlı</Text></View>
    </View>
  );
}

function StepTask(p: StepProps) {
  return (
    <>
      <View style={{ position: 'absolute', left: 20, top: 54, gap: 2 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.navy }}>Görevler</Text>
        <Text style={{ fontSize: 13, color: '#5B6274' }}>Ekim 2026</Text>
      </View>
      <View style={{ position: 'absolute', left: 20, right: 20, top: 124, flexDirection: 'row' }}>
        {WEEK.map(([d, n]) => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#5B6274' }}>{d}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>{n}</Text>
          </View>
        ))}
      </View>
      <Chips top={176} on="all" />
      <Block top={226} height={82} style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>Dişlerini fırçala</Text>
        <Text style={st.chip}>Kolay · 5</Text>
      </Block>
      <Block top={320} height={82} />
      <Block top={414} height={82} />
      <TabBar hide={2} />
      <Dim />
      <Ring style={{ right: 20, bottom: 106, width: 62, height: 62 }} radius={31} badge={2} badgeAt={{ top: -10, left: -10 }} inner={{ backgroundColor: colors.navy }}>
        <Ionicons name="add" size={32} color="#fff" />
      </Ring>
      <TabRing index={2} />
      <Trail d="M238 800 L300 800 Q330 800 330 770 L330 742" />
      {/* + sonrası açılan Görev Oluştur'un üstündeki hazır rutinlerin önizlemesi */}
      <View pointerEvents="none" style={st.preview}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.navy }}>Hazır rutinler</Text>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={[st.tile, { backgroundColor: '#FDEBD3' }]}>
            <Ionicons name="sunny-outline" size={16} color={colors.navy} />
            <Text style={st.tileText}>Güne hazır sabah</Text>
          </View>
          <View style={[st.tile, { backgroundColor: '#DCE9FB' }]}>
            <Ionicons name="school-outline" size={16} color={colors.navy} />
            <Text style={st.tileText}>Okul dönüşü</Text>
          </View>
        </View>
        <Text style={{ fontSize: 11, color: '#5B6274' }}>ya da listeden tek tek seç</Text>
      </View>
      <Coach {...p} title="Görev ver" text="Görevler'de + ile görev ekle. Hazır rutinle birkaç görevi tek seferde verirsin." style={{ left: 20, right: 20, top: 250 }} />
    </>
  );
}

/* ---------- İncele ve onayla: Ben → Onay bekleyen → ✓ (ya da satıra dokun) ---------- */

function StepReview(p: StepProps) {
  return (
    <>
      <View style={{ position: 'absolute', left: 20, top: 54, gap: 2 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.navy }}>Merhaba!</Text>
        <Text style={{ fontSize: 13, color: '#5B6274' }}>28 Ekim, Salı</Text>
      </View>
      <Block top={216} height={120} />
      <Block top={350} height={150} />
      <TabBar hide={0} />
      <Dim />
      <Trail d="M24 770 L8 770 L8 176 Q8 162 16 162" />
      <Ring style={{ left: 20, right: 20, top: 122, height: 80 }} radius={20} badge={2} badgeAt={{ top: -12, right: -12 }}
        inner={{ backgroundColor: '#DDF1EC', flexDirection: 'row', justifyContent: 'flex-start', paddingHorizontal: 18, gap: 12 }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: '#2F6B5E' }}>Onay bekleyen</Text>
          <Text style={{ fontSize: 18, fontWeight: '800', color: colors.navy }}>1 görev onayını bekliyor</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.navy} />
      </Ring>
      {/* Onay bekleyen'e dokununca açılan İnceleme'nin önizlemesi */}
      <View pointerEvents="none" style={[st.preview, st.reviewPreview]}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.navy }}>İnceleme</Text>
        <View style={st.previewRow}>
          <Face id={CHILD_FACE} size={32} />
          <View style={{ flex: 1 }}>
            <Text style={st.previewText}>Yatağını topla</Text>
            <Text style={{ fontSize: 11, color: '#5B6274' }}>Nazlı · bugün</Text>
          </View>
          <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="checkmark" size={18} color="#fff" />
          </View>
        </View>
      </View>
      <TabRing index={0} />
      <Coach {...p} title="Yaptı mı? Onayla" text="Çocuğun görevi Pofi Adası'nda görür, bitirince 'Yaptım'a basar; sana bildirim gelir. Ana sayfada 'Onay bekleyen'e dokun, ✓ ile onayla. Onaylayınca çocuğun coin ve Güneş Taşı kazanır; satıra dokunursan not eklersin." style={{ left: 20, right: 20, top: 372 }} />
    </>
  );
}

/* ---------- Sen de katıl: kendine görev ver, Güneş Taşı kazan, hediye gönder ---------- */

function StepParent(p: StepProps) {
  return (
    <>
      <View pointerEvents="none" style={{ position: 'absolute', left: 20, top: 56, alignItems: 'center', gap: 4 }}>
        <Face id={PARENT_FACE} size={54} ring />
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.navy }}>Anne</Text>
      </View>
      <Person x={90} id={CHILD_FACE} label="Nazlı" />
      <Segments active={0} />
      <Block top={190} height={84} style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16 }}>
        <Face id={PARENT_FACE} size={52} />
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>Anne</Text>
      </Block>
      <Text style={{ position: 'absolute', left: 20, top: 292, fontSize: 16, fontWeight: '700', color: colors.navy }}>Güneş Taşım</Text>
      <Block top={322} height={88} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
        <View style={st.coinDot} />
        <Text style={{ fontSize: 24, fontWeight: '800', color: colors.navy }}>5</Text>
        <Text style={{ flex: 1, fontSize: 12, color: '#5B6274' }}>kullanılabilir</Text>
        <View style={{ width: 140 }} />
      </Block>
      <TabBar hide={4} />
      <Dim />
      <Trail d="M351 760 L380 760 L380 380 Q380 366 366 366 L356 366" />
      <Ring style={{ right: 32, top: 344, width: 140, height: 44 }} radius={22} badge={2} badgeAt={{ top: -12, right: -12 }} inner={{ backgroundColor: '#FFF4D6', flexDirection: 'row', gap: 6 }}>
        <Ionicons name="gift-outline" size={16} color={colors.navy} />
        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.navy }}>Hediye dükkânı</Text>
      </Ring>
      <TabRing index={4} />
      <Coach {...p} title="Sen de katıl" text="Görevi kendine de ata, 'Yaptım' de, Güneş Taşı kazan. Güneş Taşlarıyla çocuğuna oyunda hediye gönder." style={{ left: 20, right: 32, top: 440 }} />
    </>
  );
}

/* ---------- Uzmanını ekle (isteğe bağlı, tam turun sonu): Uzmanım → Uzman bağla ---------- */

function StepClinic({ onNext, onBack, step, total }: StepProps) {
  return (
    <>
      <Text style={{ position: 'absolute', left: 20, top: 54, fontSize: 26, fontWeight: '800', color: colors.navy }}>Uzmanım</Text>
      <Block top={210} height={110} style={{ backgroundColor: '#FFF4D6' }} />
      <TabBar hide={1} />
      <Dim />
      <Trail d="M117 760 L117 196" />
      <Ring style={{ left: 20, right: 20, top: 110, height: 72 }} radius={18} badge={2} badgeAt={{ top: -14, right: -10 }}
        inner={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 16 }}>
        <View style={{ width: 42, height: 42, borderRadius: 21, borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="add" size={20} color={colors.navy} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 16, fontWeight: '800', color: colors.navy }}>Uzman bağla</Text>
          <Text style={{ fontSize: 12, color: '#5B6274' }}>Uzmanından aldığın kodla</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.navy} />
      </Ring>
      <TabRing index={1} />
      <View style={[st.card, { left: 20, right: 20, top: 360 }]}>
        <Text style={[st.counter, { alignSelf: 'flex-start' }]}>{step + 1} / {total} · isteğe bağlı</Text>
        <Text style={st.title} accessibilityRole="header">Uzmanını ekle</Text>
        <Text style={st.text}>Kodla bağlan; uzmanın programı ve önerileri burada görünür</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#2F7D4A" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#2F7D4A' }}>Yalnız senin izninle, istediğinde kapatırsın</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          {onBack && <BackBtn onPress={onBack} />}
          <Pressable onPress={onNext} accessibilityRole="button" style={[st.start, { flex: 1 }]}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Başla</Text>
          </Pressable>
        </View>
      </View>
    </>
  );
}

/* ---------- Ödüller: Ana sayfa › Ödül (çocuk Güneş Taşı yetince oyundan ister, sen onaylarsın) ---------- */

function StepRewards(p: StepProps) {
  return (
    <>
      <View style={{ position: 'absolute', left: 20, top: 54, gap: 2 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.navy }}>Merhaba!</Text>
        <Text style={{ fontSize: 13, color: '#5B6274' }}>Bugün</Text>
      </View>
      <Block top={122} height={80} style={{ backgroundColor: '#DDF1EC' }} />
      <Block top={216} height={150} />
      <Block top={380} height={150} />
      <View style={{ position: 'absolute', left: 20, right: 20, top: 646, flexDirection: 'row', gap: 8 }}>
        {['Görev ver', '', 'Davranış kaydı'].map((t, i) => (
          <View key={i} style={[st.quick, !t && { backgroundColor: 'transparent', borderColor: 'transparent' }]}><Text style={st.quickText}>{t}</Text></View>
        ))}
      </View>
      <TabBar hide={-1} active={0} />
      <Dim />
      <Ring style={{ left: 20 + (W - 56) / 3 + 8 + 14, top: 646, width: (W - 56) / 3 - 28, height: 44 }} radius={12} badge={1} badgeAt={{ top: -12, right: -12 }}
        inner={{ flexDirection: 'row', gap: 6 }}>
        <Ionicons name="gift-outline" size={18} color={colors.navy} />
        <Text style={st.quickText}>Ödül</Text>
      </Ring>
      <View pointerEvents="none" style={[st.preview, { top: 470, bottom: 'auto', right: 20 }]}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.navy }}>Ödüller</Text>
        {[['film-outline', 'Film gecesi', '12'], ['football-outline', 'Parkta oyun', '8']].map(([ic, t, n]) => (
          <View key={t} style={st.previewRow}>
            <Ionicons name={ic as keyof typeof Ionicons.glyphMap} size={18} color={colors.navy} />
            <Text style={[st.previewText, { flex: 1 }]}>{t}</Text>
            <View style={st.coinDot} /><Text style={st.previewText}>{n}</Text>
          </View>
        ))}
      </View>
      <Coach {...p} title="Ödülleri sen belirle" text="Ana sayfanın altındaki 'Ödül': film gecesi, park gibi ödüller koy. Güneş Taşı yetince çocuğun oyundan ister, sen onaylarsın." style={{ left: 20, right: 20, top: 150 }} />
    </>
  );
}

/* ---------- Mesajlar: Aile › Mesajlar ---------- */

function StepChat(p: StepProps) {
  return (
    <>
      <Person x={20} id={PARENT_FACE} label="Anne" />
      <Person x={90} id={CHILD_FACE} label="Nazlı" />
      <Segments active={0} hide={1} />
      <Block top={190} height={300} style={{ padding: 16, gap: 10 }}>
        <View style={{ alignSelf: 'flex-start', backgroundColor: '#EEF1F6', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 14, color: colors.navy }}>Anne bugün çok eğlendim!</Text>
        </View>
        <View style={{ alignSelf: 'flex-end', backgroundColor: colors.navy, borderRadius: 14, paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ fontSize: 14, color: '#fff' }}>Seninle gurur duyuyorum 🌟</Text>
        </View>
      </Block>
      <TabBar hide={4} />
      <Dim />
      <Trail d="M351 760 L380 760 L380 210 Q380 198 368 198 L205 198 Q193 198 193 186" />
      <Ring style={{ left: 150, top: 140, width: 86, height: 32 }} radius={16} badge={2} badgeAt={{ top: -14, right: -14 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.navy }}>Mesajlar</Text>
      </Ring>
      <TabRing index={4} />
      <Coach {...p} title="Mesajlaş" text="Aile › Mesajlar: yazı, fotoğraf, sesli mesaj ya da çıkartma gönder. Çocuğun oyunda okur, sana yazıyla ya da çıkartmayla döner." style={{ left: 20, right: 32, top: 400 }} />
    </>
  );
}

/* ---------- Gelişim: alışkanlıklar, seri, haftalık tamamlama ---------- */

const BARS = [40, 70, 55, 90, 65, 80, 100];

function StepProgress(p: StepProps) {
  return (
    <>
      <Text style={{ position: 'absolute', left: 20, top: 54, fontSize: 26, fontWeight: '800', color: colors.navy }}>Gelişim</Text>
      <Block top={330} height={120} />
      <TabBar hide={3} />
      <Dim />
      <Ring style={{ left: 20, right: 20, top: 110, height: 190 }} radius={18} badge={2} badgeAt={{ top: -12, right: -12 }} inner={{ alignItems: 'stretch', justifyContent: 'flex-start', padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: colors.navy }}>Günlük tutarlılık</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#2F7D4A' }}>Seri: 4 gün</Text>
        </View>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
          {BARS.map((h, i) => <View key={i} style={{ flex: 1, height: `${h}%`, borderRadius: 6, backgroundColor: i === BARS.length - 1 ? GOLD : '#C9D3E6' }} />)}
        </View>
      </Ring>
      <TabRing index={3} />
      <Coach {...p} title="Gelişimi izle" text="Gelişim sekmesinde günlük tutarlılık, seri ve haftalık tamamlama. Hangi alışkanlığın oturduğunu görürsün." style={{ left: 20, right: 20, top: 400 }} />
    </>
  );
}

/* ---------- Ödüller ekranı turu (mode: rewards): taş kazanılır → ödül ekle → ödülü ver ---------- */

// Örnek çocuklar: harf ve renkler Ödüller ekranındakiyle aynı düzen
const KIDS: { name: string; bal: number; tint: [string, string] }[] = [
  { name: 'Nazlı', bal: 14, tint: ['#FDE7EA', '#B3263E'] },
  { name: 'Can', bal: 6, tint: ['#E6F4EA', '#2F7D4A'] },
];
const R_ROWS: { icon: keyof typeof Ionicons.glyphMap; title: string; price: string; cost: number }[] = [
  { icon: 'film-outline', title: 'Film gecesi', price: '12 Güneş Taşı', cost: 12 },
  { icon: 'football-outline', title: 'Parkta oyun', price: '8 Güneş Taşı', cost: 8 },
  { icon: 'tablet-portrait-outline', title: 'Tablet süresi', price: '1 Güneş Taşı = 10 dk', cost: 1 },
];
const R_TOP = { bal: 100, req: 166, sugLabel: 234, sug: 266, title: 322, card: 350 };
const LETTER = 44;
// Satırdaki harflerin yeri (sağdan: Can, Nazlı)
const letterLeft = (k: number) => W - 20 - 14 - LETTER - (KIDS.length - 1 - k) * (LETTER + 8);
const rowTop = (i: number) => R_TOP.card + i * 64;

function KidLetter({ k, faded, size = LETTER }: { k: number; faded?: boolean; size?: number }) {
  const [bg, fg] = KIDS[k].tint;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: faded ? '#F1F2F6' : bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.36, fontWeight: '800', color: faded ? '#B4B9C6' : fg }}>{KIDS[k].name[0]}</Text>
    </View>
  );
}

function Balance({ k }: { k: number }) {
  return (
    <>
      <KidLetter k={k} size={32} />
      <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: colors.navy }}>{KIDS[k].name}</Text>
      <Ionicons name="sunny" size={14} color={GOLD} />
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.navy }}>{KIDS[k].bal}</Text>
      <Ionicons name="chevron-forward" size={14} color={colors.faint} />
    </>
  );
}

const SUGGEST = [['Dondurma', '6'], ['Kitap okuma', '4']];
function Suggestions() {
  return (
    <View style={{ flexDirection: 'row', gap: 8 }}>
      {SUGGEST.map(([t, n]) => (
        <View key={t} style={st.sugChip}>
          <Ionicons name="add" size={15} color={colors.navy} />
          <Text style={{ fontSize: 13, fontWeight: '600', color: colors.navy }}>{t}</Text>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#5B6274' }}>{n}</Text>
        </View>
      ))}
    </View>
  );
}

// Ödüller ekranının sade kopyası; hide: halkayla üstte çizilecek parça boş bırakılır
function RewardsMock({ hide }: { hide?: 'bal' | 'sug' | 'letter' }) {
  return (
    <>
      <View style={{ position: 'absolute', left: 14, right: 14, top: 50, height: 40, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Ionicons name="chevron-back" size={22} color={colors.navy} />
        <Text style={{ flex: 1, fontSize: 20, fontWeight: '700', color: colors.navy }}>Ödüller</Text>
        <Ionicons name="information-circle-outline" size={22} color={colors.navy} />
        <Ionicons name="time-outline" size={22} color={colors.navy} />
      </View>
      {hide !== 'bal' && KIDS.map((_, k) => (
        <View key={k} style={[st.balance, { left: 20 + k * ((W - 48) / 2 + 8), top: R_TOP.bal, width: (W - 48) / 2 }]}><Balance k={k} /></View>
      ))}
      <View style={[st.request, { top: R_TOP.req }]}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#6B5300' }}>Nazlı istiyor</Text>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>Parkta oyun · 8 Güneş Taşı</Text>
        </View>
        <View style={[st.round, { backgroundColor: '#fff' }]}><Ionicons name="close" size={18} color={colors.navy} /></View>
        <View style={[st.round, { backgroundColor: colors.navy }]}><Ionicons name="checkmark" size={18} color="#fff" /></View>
      </View>
      <View style={{ position: 'absolute', left: 20, right: 20, top: R_TOP.sugLabel, flexDirection: 'row' }}>
        <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#3D4559' }}>Öneriler · dokun, eklensin</Text>
        <Text style={{ fontSize: 14, fontWeight: '700', color: colors.navy }}>Tümü ›</Text>
      </View>
      {hide !== 'sug' && <View style={{ position: 'absolute', left: 20, top: R_TOP.sug }}><Suggestions /></View>}
      <Text style={{ position: 'absolute', left: 20, top: R_TOP.title, fontSize: 16, fontWeight: '700', color: colors.navy }}>Ödüller</Text>
      <Block top={R_TOP.card} height={R_ROWS.length * 64} style={{ borderRadius: 14 }}>
        {R_ROWS.map((r, i) => (
          <View key={r.title} style={{ height: 64, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <View style={st.rIcon}><Ionicons name={r.icon} size={20} color={colors.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>{r.title}</Text>
              <Text style={{ fontSize: 12, color: '#5B6274' }}>{r.price}</Text>
            </View>
            {KIDS.map((kid, k) => (
              <View key={k} style={{ opacity: hide === 'letter' && i === 0 && k === 0 ? 0 : 1 }}>
                <KidLetter k={k} faded={kid.bal < r.cost} />
              </View>
            ))}
          </View>
        ))}
      </Block>
      <View style={st.newReward}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Yeni ödül</Text>
      </View>
    </>
  );
}

function StepEarn(p: StepProps) {
  return (
    <>
      <RewardsMock hide="bal" />
      <Dim />
      <Ring style={{ left: 20, top: R_TOP.bal, width: W - 40, height: 52 }} radius={14} badge={1} badgeAt={{ top: -12, left: -12 }}
        inner={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 6, paddingLeft: 10, paddingRight: 8 }}>
        <Balance k={0} />
        <View style={{ width: 1, height: 30, backgroundColor: colors.line, marginHorizontal: 4 }} />
        <Balance k={1} />
      </Ring>
      <Coach {...p} title="Güneş Taşı görevden gelir" text="Onayladığın her görev Güneş Taşı kazandırır: kolay 1, orta 2, zor 3." style={{ left: 20, right: 20, top: 200 }} />
    </>
  );
}

function StepAdd(p: StepProps) {
  return (
    <>
      <RewardsMock hide="sug" />
      <Dim />
      <Ring style={{ left: 20, top: R_TOP.sug, width: W - 40, height: 40 }} radius={20} badge={1} badgeAt={{ top: -12, left: -12 }}
        inner={{ backgroundColor: '#F5F6F8', alignItems: 'flex-start', justifyContent: 'center' }}>
        <Suggestions />
      </Ring>
      <Ring style={{ right: 20, bottom: 34, width: 150, height: 56 }} radius={28} badge={2} badgeAt={{ top: -12, left: -12 }}
        inner={{ backgroundColor: colors.navy, flexDirection: 'row', gap: 8 }}>
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={{ color: '#fff', fontSize: 15, fontWeight: '700' }}>Yeni ödül</Text>
      </Ring>
      <Coach {...p} title="Ödülü sen belirle" text="Bir öneriye dokun, eklensin. Ya da 'Yeni ödül' ile kendininkini yaz." style={{ left: 20, right: 20, top: 340 }} />
    </>
  );
}

function StepGive(p: StepProps) {
  const top = rowTop(0) + 10;
  return (
    <>
      <RewardsMock hide="letter" />
      <Dim />
      <Ring style={{ left: letterLeft(0), top, width: LETTER, height: LETTER }} radius={LETTER / 2} badge={1} badgeAt={{ top: -14, left: -14 }}
        inner={{ backgroundColor: KIDS[0].tint[0] }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: KIDS[0].tint[1] }}>N</Text>
      </Ring>
      {/* Harfe dokununca çıkan onay kartının önizlemesi */}
      <View pointerEvents="none" style={[st.preview, { top: top - 140, bottom: 'auto', left: 110, right: 20 }]}>
        <Text style={{ fontSize: 12, fontWeight: '700', color: '#5B6274' }}>Nazlı'ya verilsin mi?</Text>
        <View style={st.previewRow}>
          <Ionicons name="film-outline" size={18} color={colors.navy} />
          <Text style={[st.previewText, { flex: 1 }]}>Film gecesi</Text>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.danger }}>−12 Güneş Taşı</Text>
        </View>
        <View style={st.previewBtn}><Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Onayla, ver</Text></View>
      </View>
      <Coach {...p} title="Ödülü ver" text="Ödülün yanındaki harfe dokun, onayla. Çocuğun oyundan da isteyebilir; onay senden."
        note="Coin ve Güneş Taşı'nın parasal değeri yoktur: satın alınamaz, paraya çevrilemez. Ödülün sözünü sen verirsin; biz ödüllerin tarafı değiliz."
        style={{ left: 20, right: 20, top: top + LETTER + 30 }} />
    </>
  );
}

/* ---------- Önce sor: "Göster / Şimdi değil" (kendiliğinden açılınca) ---------- */

function Ask({ total, onShow, onLater }: { total: number; onShow: () => void; onLater: () => void }) {
  return (
    <>
      <View style={{ position: 'absolute', left: 20, top: 54 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.navy }}>Merhaba!</Text>
      </View>
      <Block top={122} height={80} style={{ backgroundColor: '#DDF1EC' }} />
      <Block top={216} height={150} />
      <TabBar hide={-1} active={0} />
      <Dim />
      <View style={[st.card, { left: 20, right: 20, top: 300 }]}>
        <Text style={[st.counter, { alignSelf: 'flex-start' }]}>{total} adım · 30 saniye</Text>
        <Text style={st.title} accessibilityRole="header">ParentApp nasıl çalışır?</Text>
        <Text style={st.text}>Görev verirsin, çocuğun oyunda yapar, sen onaylarsın. Kısaca göstereyim mi?</Text>
        <Pressable onPress={onShow} accessibilityRole="button" style={st.start}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Göster</Text>
        </Pressable>
        <Pressable onPress={onLater} accessibilityRole="button" hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 4 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#5B6274' }}>Şimdi değil</Text>
        </Pressable>
        <Text style={{ fontSize: 12, color: '#5B6274', textAlign: 'center' }}>İstediğin zaman: Aile › Hesap › Nasıl kullanılır?</Text>
      </View>
    </>
  );
}

const SCENES: Record<StepId, (p: StepProps) => React.ReactElement> = {
  task: StepTask, review: StepReview, rewards: StepRewards, chat: StepChat, progress: StepProgress, parent: StepParent, clinic: StepClinic,
  rEarn: StepEarn, rAdd: StepAdd, rGive: StepGive,
};

const st = StyleSheet.create({
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', paddingTop: 10 },
  tabText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  card: { position: 'absolute', backgroundColor: '#fff', borderRadius: 22, padding: 18, gap: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  counter: { fontSize: 12, fontWeight: '700', color: '#6B5300', backgroundColor: '#FFF6DE', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9, overflow: 'hidden' },
  title: { fontSize: 24, fontWeight: '800', color: colors.navy },
  text: { fontSize: 15, color: '#4A5165' },
  next: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  back: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  start: { marginTop: 4, height: 50, borderRadius: 14, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  chip: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: '#2F7D4A', backgroundColor: '#E6F4EA', borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8, overflow: 'hidden' },
  preview: { position: 'absolute', left: 20, right: 110, bottom: 100, backgroundColor: '#fff', borderRadius: 18, padding: 12, gap: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewPreview: { top: 232, bottom: 'auto', right: 20 },
  previewText: { fontSize: 13, fontWeight: '600', color: colors.navy },
  check: { width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  coin: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#FFF4D6', borderRadius: 999, paddingHorizontal: 10, height: 30 },
  coinDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold },
  fchip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 34, paddingLeft: 6, paddingRight: 12, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line },
  fchipOn: { backgroundColor: colors.navy, borderColor: colors.navy, paddingLeft: 12 },
  fchipText: { fontSize: 13, fontWeight: '700', color: colors.navy },
  tile: { flex: 1, borderRadius: 12, padding: 10, gap: 6, height: 70 },
  tileText: { fontSize: 12, fontWeight: '700', color: colors.navy },
  previewBtn: { height: 34, borderRadius: 10, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  quick: { flex: 1, height: 44, borderRadius: 12, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontSize: 13, fontWeight: '700', color: colors.navy },
  note: { fontSize: 12, lineHeight: 17, color: '#5B6274' },
  balance: { position: 'absolute', height: 52, borderRadius: 14, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 10, paddingRight: 8 },
  request: { position: 'absolute', left: 20, right: 20, height: 58, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF6DE', borderRadius: 14, paddingLeft: 12, paddingRight: 8 },
  round: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  sugChip: { height: 40, paddingLeft: 10, paddingRight: 14, borderRadius: 20, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 6 },
  rIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' },
  newReward: { position: 'absolute', right: 20, bottom: 34, width: 150, height: 56, borderRadius: 28, backgroundColor: colors.navy, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});
