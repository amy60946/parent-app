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
// 28 Ekim 2026 (kullanıcı isteği): son sürüme göre yeniden çizildi: Okti avatarları, Görevler'de Ben + hazır rutinler,
// İnceleme'de ✓ ve ayrıntı sayfası, yeni adım "Sen de katıl" (ebeveyn görevi, Güneş Taşı, hediye dükkânı).

const KEY = 'onboarding-v1';
const W = 390;
const H = 844;
const GOLD = colors.gold;
const HALO = 'rgba(233,178,43,0.3)';
const DIM = 'rgba(15,27,61,0.62)';
// Açık zemin (#F5F6F8) üstünde karartmanın görünen rengi: ölçeklenen sahnenin dışındaki boşluk
const DIM_SOLID = '#666E84';
const ALL = [0, 1, 2, 3, 4, 5];

export async function shouldShowOnboarding(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) !== '1'; } catch { return false; }
}

export async function markOnboardingSeen() {
  try { await AsyncStorage.setItem(KEY, '1'); } catch { /* yalnız bu cihazda hatırlanır */ }
}

// steps: gösterilecek adımlar (0 çocuk ekle · 1 oyun kodu · 2 görev ver · 3 onayla · 4 sen de katıl · 5 uzmanını ekle).
// Uzman davetiyle gelen için [1, 2, 3, 4]: çocuk ve uzman davette eklendi. "Sen de katıl" sunucuda ebeveyn görevleri yoksa atlanır.
export default function Onboarding({ visible, onClose, steps: wanted = ALL }: { visible: boolean; onClose: () => void; steps?: number[] }) {
  const pt = useParentTasks();
  const steps = wanted.filter((n) => n !== 4 || pt.ready);
  const [step, setStep] = useState(0);
  const { width, height } = useWindowDimensions();
  const s = Math.min(width / W, height / H);
  React.useEffect(() => { if (visible) setStep(0); }, [visible]);

  const finish = (done: boolean) => {
    track(done ? 'onboarding.done' : 'onboarding.skip', done ? {} : { step: step + 1 });
    markOnboardingSeen();
    onClose();
  };
  const total = steps.length;
  const next = () => (step < total - 1 ? setStep(step + 1) : finish(true));
  const Step = [Step1, Step2, Step3, Step4, StepParent, Step5][steps[step] ?? 0];

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="overFullScreen" transparent onRequestClose={() => finish(false)}>
      <View style={{ flex: 1, backgroundColor: DIM_SOLID, justifyContent: 'flex-end', alignItems: 'center' }}>
        <View style={{ width: W * s, height: H * s }}>
          <View style={{ position: 'absolute', left: (W * s - W) / 2, top: (H * s - H) / 2, width: W, height: H, transform: [{ scale: s }], overflow: 'hidden', backgroundColor: '#F5F6F8' }}>
            <Step step={step} total={total} onNext={next} onSkip={() => finish(false)} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

type StepProps = { step: number; total: number; onNext: () => void; onSkip: () => void };

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
  style: StyleProp<ViewStyle>; radius: number; badge: number; badgeAt: ViewStyle; inner?: StyleProp<ViewStyle>; children?: React.ReactNode;
}) {
  return (
    <View pointerEvents="none" style={[{ position: 'absolute' }, style]}>
      <View style={{ position: 'absolute', left: -12, top: -12, right: -12, bottom: -12, borderRadius: radius + 12, backgroundColor: HALO }} />
      <View style={{ position: 'absolute', left: -4, top: -4, right: -4, bottom: -4, borderRadius: radius + 4, backgroundColor: GOLD }} />
      <View style={[{ flex: 1, borderRadius: radius, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, inner]}>
        {children}
      </View>
      <Badge n={badge} style={badgeAt} />
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

const TAB_NAMES = ['Görevler', 'İnceleme', 'Gelişim', 'Aile'];
const TAB_ICONS: (keyof typeof Ionicons.glyphMap)[] = ['list-outline', 'checkmark-circle-outline', 'stats-chart-outline', 'people-outline'];

// Alttaki sekme çubuğu; vurgulanacak sekmenin yeri boş bırakılır (Ring onu karartmanın üstüne çizer).
function TabBar({ hide, active }: { hide: number; active?: number }) {
  return (
    <View style={st.tabBar}>
      {TAB_NAMES.map((t, i) => (
        <View key={t} style={{ flex: 1, alignItems: 'center' }}>
          {i !== hide && <Text style={[st.tabText, i === active && { color: colors.navy, fontWeight: '800' }]}>{t}</Text>}
        </View>
      ))}
    </View>
  );
}

function TabRing({ index, left, width }: { index: number; left: number; width: number }) {
  return (
    <Ring style={{ left, bottom: 14, width, height: 60 }} radius={16} badge={1} badgeAt={{ top: -12, left: -10 }}>
      <Ionicons name={TAB_ICONS[index]} size={22} color={colors.navy} />
      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.navy, marginTop: 3 }}>{TAB_NAMES[index]}</Text>
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
const CHILD_FACE = 'flamingo';

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
function Coach({ step, total, title, text, onNext, onSkip, style }: StepProps & { title: string; text: string; style: ViewStyle }) {
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
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
        <View style={{ flexDirection: 'row', gap: 5 }} accessible accessibilityLabel={`Adım ${step + 1} / ${total}`}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={{ width: i === step ? 18 : 7, height: 7, borderRadius: 4, backgroundColor: i === step ? colors.navy : '#D5D9E2' }} />
          ))}
        </View>
        <Pressable onPress={onNext} accessibilityRole="button" accessibilityLabel="İleri" style={st.next}>
          <Ionicons name="arrow-forward" size={20} color="#fff" />
        </Pressable>
      </View>
    </View>
  );
}

/* ---------- 1 · Çocuğunu ekle: Aile → + ---------- */

function Step1(p: StepProps) {
  return (
    <>
      <Person x={20} id={PARENT_FACE} label="Anne" />
      <View style={{ position: 'absolute', right: 20, top: 66 }}><Ionicons name="notifications-outline" size={24} color={colors.navy} /></View>
      <Segments active={0} />
      <Block top={190} height={96} />
      <Block top={302} height={150} />
      <TabBar hide={3} />
      <Dim />
      <Trail d="M341 760 L360 760 L360 110 Q360 84 334 84 L128 84" />
      <View pointerEvents="none" style={{ position: 'absolute', left: 90, top: 56, alignItems: 'center', gap: 4 }}>
        <Ring style={{ position: 'relative', width: 54, height: 54 }} radius={27} badge={2} badgeAt={{ top: -10, right: -12 }} inner={{ backgroundColor: colors.navy }}>
          <Ionicons name="add" size={28} color="#fff" />
        </Ring>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>Ekle</Text>
      </View>
      <TabRing index={3} left={302} width={78} />
      <Coach {...p} title="Çocuğunu ekle" text="Aile sekmesi, sonra +. Avatarını Okti'lerden seç ya da fotoğrafını koy." style={{ left: 20, width: 300, top: 300 }} />
    </>
  );
}

/* ---------- 2 · Oyun kodu: çocuk → Giriş kodu üret ---------- */

function Step2(p: StepProps) {
  return (
    <>
      <Person x={20} id={PARENT_FACE} label="Anne" />
      <View style={{ position: 'absolute', left: 160, top: 56, alignItems: 'center', gap: 4 }}>
        <View style={[st.avatar, { backgroundColor: colors.navy }]}><Ionicons name="add" size={24} color="#fff" /></View>
        <Text style={{ fontSize: 11, fontWeight: '600', color: 'transparent' }}>.</Text>
      </View>
      <Segments active={0} />
      <Block top={186} height={76} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
        <Face id={CHILD_FACE} size={44} />
        <Text style={{ flex: 1, fontSize: 16, fontWeight: '700', color: colors.navy }}>Nazlı</Text>
        <View style={st.coin}><View style={st.coinDot} /><Text style={{ fontSize: 14, fontWeight: '800', color: colors.navy }}>0</Text></View>
      </Block>
      <Block top={274} height={52} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 }}>
        <View style={st.coinDot} /><Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>Güneş Taşı · 0</Text>
      </Block>
      <Block top={338} height={52} />
      <Block top={402} height={128} style={{ padding: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>Giriş kodu</Text>
      </Block>
      <TabBar hide={-1} active={3} />
      <Dim />
      <Trail d="M117 134 L117 160 Q117 172 129 172 L362 172 Q374 172 374 186 L374 470 Q374 484 360 484 L356 484" />
      <View pointerEvents="none" style={{ position: 'absolute', left: 90, top: 56, alignItems: 'center', gap: 4 }}>
        <Ring style={{ position: 'relative', width: 54, height: 54 }} radius={27} badge={1} badgeAt={{ top: -10, right: -12 }}>
          <Face id={CHILD_FACE} size={50} />
        </Ring>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>Nazlı</Text>
      </View>
      <Ring style={{ left: 36, right: 36, top: 458, height: 50 }} radius={14} badge={2} badgeAt={{ top: -12, right: -12 }} inner={{ backgroundColor: colors.navy }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Giriş kodu üret</Text>
      </Ring>
      <Coach {...p} title="Oyun kodunu al" text="Kısa veli onayından sonra kodu oyuna yaz ya da QR'ı okut" style={{ left: 20, right: 20, top: 560 }} />
    </>
  );
}

/* ---------- 3 · Görev ver: Görevler → + (hazır rutinler) ---------- */

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

function Step3(p: StepProps) {
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
      <TabBar hide={0} />
      <Dim />
      <Ring style={{ right: 20, bottom: 106, width: 62, height: 62 }} radius={31} badge={2} badgeAt={{ top: -10, left: -10 }} inner={{ backgroundColor: colors.navy }}>
        <Ionicons name="add" size={32} color="#fff" />
      </Ring>
      <TabRing index={0} left={8} width={82} />
      <Trail d="M96 800 L300 800 Q330 800 330 770 L330 742" />
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
      <Coach {...p} title="Görev ver" text="Görevler, sonra +. Hazır rutinle birkaç görevi tek seferde ekle." style={{ left: 20, right: 20, top: 250 }} />
    </>
  );
}

/* ---------- 4 · İncele ve onayla: İnceleme → ✓ (ya da satıra dokun) ---------- */

function Step4(p: StepProps) {
  return (
    <>
      <View style={{ position: 'absolute', left: 20, top: 56, alignItems: 'center', gap: 4 }}>
        <View style={[st.avatar, { backgroundColor: colors.navy }]}><Text style={{ fontSize: 12, fontWeight: '800', color: '#fff' }}>Tümü</Text></View>
      </View>
      <Person x={90} id={CHILD_FACE} label="Nazlı" />
      <Text style={{ position: 'absolute', left: 20, top: 140, fontSize: 18, fontWeight: '800', color: colors.navy }}>İnceleme</Text>
      <Block top={180} height={72} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14 }}>
        <Face id={CHILD_FACE} size={36} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>Yatağını topla</Text>
          <Text style={{ fontSize: 12, color: '#5B6274' }}>Nazlı · 28 Ekim</Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={colors.faint} />
        <View style={{ width: 46 }} />
      </Block>
      <TabBar hide={1} />
      <Dim />
      <Trail d="M146 744 L146 712 Q146 700 158 700 L366 700 Q378 700 378 686 L378 230 Q378 216 364 216 L364 216" />
      <Ring style={{ right: 30, top: 194, width: 44, height: 44 }} radius={22} badge={2} badgeAt={{ top: -12, right: -12 }} inner={{ backgroundColor: colors.navy }}>
        <Ionicons name="checkmark" size={22} color="#fff" />
      </Ring>
      <TabRing index={1} left={106} width={80} />
      <Coach {...p} title="Yaptı mı? Onayla" text="✓ ile hemen onayla. Satıra dokunursan Güneş Taşı ve not ekler, gerekirse 'Tekrar dene' dersin." style={{ left: 20, right: 20, top: 290 }} />
    </>
  );
}

/* ---------- 5 · Sen de katıl: kendine görev ver, Güneş Taşı kazan, hediye gönder ---------- */

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
      <TabBar hide={3} />
      <Dim />
      <Trail d="M341 760 L376 760 L376 380 Q376 366 362 366 L356 366" />
      <Ring style={{ right: 32, top: 344, width: 140, height: 44 }} radius={22} badge={2} badgeAt={{ top: -12, right: -12 }} inner={{ backgroundColor: '#FFF4D6', flexDirection: 'row', gap: 6 }}>
        <Ionicons name="gift-outline" size={16} color={colors.navy} />
        <Text style={{ fontSize: 13, fontWeight: '800', color: colors.navy }}>Hediye dükkânı</Text>
      </Ring>
      <TabRing index={3} left={302} width={78} />
      <Coach {...p} title="Sen de katıl" text="Görevi kendine de ata, 'Yaptım' de, Güneş Taşı kazan. Taşlarla çocuğuna oyunda hediye gönder." style={{ left: 20, right: 20, top: 440 }} />
    </>
  );
}

/* ---------- 6 · Uzmanını ekle (isteğe bağlı): Aile → Hesap → Uzmanım ---------- */

const ACCOUNT = ['Üyelik', 'Hesabı yönet', 'Kod gir', 'Bildirimler', '', 'Nasıl kullanılır?', 'Yasal metinler'];

function Step5({ onNext, step, total }: StepProps) {
  return (
    <>
      <Person x={20} id={PARENT_FACE} label="Anne" />
      <Person x={90} id={CHILD_FACE} label="Nazlı" />
      <Segments hide={2} />
      <Block top={186} height={378}>
        {ACCOUNT.map((t, i) => (
          <View key={i} style={[{ height: 54, justifyContent: 'center', paddingHorizontal: 16 }, i < ACCOUNT.length - 1 && t !== '' && ACCOUNT[i + 1] !== '' && { borderBottomWidth: 1, borderBottomColor: colors.line }]}>
            <Text style={{ fontSize: 15, color: colors.navy }}>{t}</Text>
          </View>
        ))}
      </Block>
      <TabBar hide={3} />
      <Dim />
      <Trail d="M341 760 L376 760 L376 170 Q376 156 362 156 L323 156" />
      <Trail d="M285 176 L285 400" />
      <Ring style={{ left: 247, top: 138, width: 76, height: 36 }} radius={18} badge={2} badgeAt={{ top: -14, right: -14 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.navy }}>Hesap</Text>
      </Ring>
      <Ring style={{ left: 20, right: 20, top: 402, height: 54 }} radius={14} badge={3} badgeAt={{ top: -14, right: -10 }}
        inner={{ flexDirection: 'row', justifyContent: 'flex-start', gap: 12, paddingHorizontal: 16 }}>
        <Ionicons name="medkit-outline" size={20} color={colors.navy} />
        <Text style={{ flex: 1, fontSize: 15, fontWeight: '800', color: colors.navy }}>Uzmanım</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.navy} />
      </Ring>
      <TabRing index={3} left={302} width={78} />
      <View style={[st.card, { left: 20, width: 300, top: 490 }]}>
        <Text style={[st.counter, { alignSelf: 'flex-start' }]}>{step + 1} / {total} · isteğe bağlı</Text>
        <Text style={st.title} accessibilityRole="header">Uzmanını ekle</Text>
        <Text style={st.text}>Kodla bağlan, istediğinde kapat</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#2F7D4A" />
          <Text style={{ fontSize: 12, fontWeight: '600', color: '#2F7D4A' }}>Yalnız senin izninle</Text>
        </View>
        <Pressable onPress={onNext} accessibilityRole="button" style={st.start}>
          <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Başla</Text>
        </Pressable>
      </View>
    </>
  );
}

const st = StyleSheet.create({
  tabBar: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 84, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.line, flexDirection: 'row', paddingTop: 10 },
  tabText: { fontSize: 11, fontWeight: '600', color: colors.muted },
  avatar: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  card: { position: 'absolute', backgroundColor: '#fff', borderRadius: 22, padding: 18, gap: 10, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: 16 }, elevation: 12 },
  counter: { fontSize: 12, fontWeight: '700', color: '#6B5300', backgroundColor: '#FFF6DE', borderRadius: 10, paddingVertical: 3, paddingHorizontal: 9, overflow: 'hidden' },
  title: { fontSize: 24, fontWeight: '800', color: colors.navy },
  text: { fontSize: 15, color: '#4A5165' },
  next: { width: 48, height: 48, borderRadius: 24, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  start: { marginTop: 4, height: 50, borderRadius: 14, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  chip: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '700', color: '#2F7D4A', backgroundColor: '#E6F4EA', borderRadius: 8, paddingVertical: 2, paddingHorizontal: 8, overflow: 'hidden' },
  preview: { position: 'absolute', left: 20, right: 110, bottom: 100, backgroundColor: '#fff', borderRadius: 18, padding: 12, gap: 8, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
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
});
