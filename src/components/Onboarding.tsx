import React, { useState } from 'react';
import { Modal, View, Text, Pressable, StyleSheet, useWindowDimensions, ViewStyle, StyleProp } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors } from '../theme';
import { track } from '../lib/track';

// İlk kullanım rehberi (kullanıcı onayı 26 Ekim 2026, tasarım G1 "numaralı dokunuş yolu"):
// gerçek ekranın sade kopyası karartılır, dokunulacak yerler altın halka + 1 → 2 → 3 sırasıyla gösterilir.
// Tasarım 390×844 noktada çizildi; ekrana sığacak kadar ölçeklenir, alta (sekme çubuğuna) hizalanır.

const KEY = 'onboarding-v1';
const W = 390;
const H = 844;
const GOLD = colors.gold;
const HALO = 'rgba(233,178,43,0.3)';
const DIM = 'rgba(15,27,61,0.62)';
// Açık zemin (#F5F6F8) üstünde karartmanın görünen rengi: ölçeklenen sahnenin dışındaki boşluk
const DIM_SOLID = '#666E84';
const ALL = [0, 1, 2, 3, 4];

export async function shouldShowOnboarding(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(KEY)) !== '1'; } catch { return false; }
}

export async function markOnboardingSeen() {
  try { await AsyncStorage.setItem(KEY, '1'); } catch { /* yalnız bu cihazda hatırlanır */ }
}

// steps: gösterilecek adımlar (0 çocuk ekle · 1 oyun kodu · 2 görev ver · 3 onayla · 4 uzmanını ekle).
// Uzman davetiyle gelen için [1, 2, 3]: çocuk ve uzman davette eklendi.
export default function Onboarding({ visible, onClose, steps = ALL }: { visible: boolean; onClose: () => void; steps?: number[] }) {
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
  const Step = [Step1, Step2, Step3, Step4, Step5][steps[step] ?? 0];

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

function Avatar({ x, letter, label, tint, labelColor = colors.navy }: { x: number; letter: string; label: string; tint: [string, string]; labelColor?: string }) {
  return (
    <View style={{ position: 'absolute', left: x, top: 56, alignItems: 'center', gap: 4 }}>
      <View style={[st.avatar, { backgroundColor: tint[0] }]}><Text style={{ fontWeight: '800', color: tint[1] }}>{letter}</Text></View>
      <Text style={{ fontSize: 11, fontWeight: '600', color: labelColor }}>{label}</Text>
    </View>
  );
}

const ANNE: [string, string] = ['#E6EAF5', '#2C4A9A'];
const CHILD: [string, string] = ['#FDE7EA', '#B3263E'];

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
      <Avatar x={20} letter="A" label="Anne" tint={ANNE} />
      <View style={{ position: 'absolute', right: 20, top: 66 }}><Ionicons name="notifications-outline" size={24} color={colors.navy} /></View>
      <Segments active={0} />
      <Block top={190} height={120} />
      <Block top={326} height={160} />
      <Block top={502} height={140} />
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
      <Coach {...p} title="Çocuğunu ekle" text="Aile sekmesi, sonra +" style={{ left: 20, width: 300, top: 300 }} />
    </>
  );
}

/* ---------- 2 · Oyun kodu: çocuk → Giriş kodu üret ---------- */

function Step2(p: StepProps) {
  return (
    <>
      <Avatar x={20} letter="A" label="Anne" tint={ANNE} />
      <View style={{ position: 'absolute', left: 160, top: 56, alignItems: 'center', gap: 4 }}>
        <View style={[st.avatar, { backgroundColor: colors.navy }]}><Ionicons name="add" size={24} color="#fff" /></View>
        <Text style={{ fontSize: 11, fontWeight: '600', color: colors.navy }}>Ekle</Text>
      </View>
      <Segments active={0} />
      <Block top={186} height={76} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16 }}>
        <View style={[st.avatar, { width: 44, height: 44, borderRadius: 22, backgroundColor: CHILD[0] }]}><Text style={{ fontWeight: '800', color: CHILD[1] }}>N</Text></View>
        <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>Nazlı</Text>
      </Block>
      <Block top={276} height={70} />
      <Block top={360} height={150} style={{ padding: 16 }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>Giriş kodu</Text>
      </Block>
      <TabBar hide={-1} active={3} />
      <Dim />
      <Trail d="M117 134 L117 160 Q117 172 129 172 L338 172 Q352 172 352 186 L352 420 Q352 434 338 434 L330 434" />
      <View pointerEvents="none" style={{ position: 'absolute', left: 90, top: 56, alignItems: 'center', gap: 4 }}>
        <Ring style={{ position: 'relative', width: 54, height: 54 }} radius={27} badge={1} badgeAt={{ top: -10, right: -12 }} inner={{ backgroundColor: CHILD[0] }}>
          <Text style={{ fontWeight: '800', color: CHILD[1] }}>N</Text>
        </Ring>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#fff' }}>Nazlı</Text>
      </View>
      <Ring style={{ left: 36, right: 60, top: 410, height: 50 }} radius={14} badge={2} badgeAt={{ top: -12, right: -12 }} inner={{ backgroundColor: colors.navy }}>
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>Giriş kodu üret</Text>
      </Ring>
      <Coach {...p} title="Oyun kodunu al" text="Kodu çocuğun oyununa gir ya da QR'ı okut" style={{ left: 20, right: 20, top: 530 }} />
    </>
  );
}

/* ---------- 3 · Görev ver: Görevler → + ---------- */

const WEEK = [['Pzt', '26'], ['Sal', '27'], ['Çar', '28'], ['Per', '29'], ['Cum', '30'], ['Cmt', '31'], ['Paz', '1']];

function Step3(p: StepProps) {
  return (
    <>
      <View style={{ position: 'absolute', left: 20, top: 54, gap: 2 }}>
        <Text style={{ fontSize: 26, fontWeight: '800', color: colors.navy }}>Görevler</Text>
        <Text style={{ fontSize: 13, color: '#5B6274' }}>Bu hafta</Text>
      </View>
      <View style={{ position: 'absolute', left: 20, right: 20, top: 124, flexDirection: 'row' }}>
        {WEEK.map(([d, n]) => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: '#5B6274' }}>{d}</Text>
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.navy }}>{n}</Text>
          </View>
        ))}
      </View>
      <Block top={190} height={82} style={{ paddingVertical: 14, paddingHorizontal: 16, gap: 6 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.navy }}>Dişlerini fırçala</Text>
        <Text style={st.chip}>Kolay · 5</Text>
      </Block>
      <Block top={284} height={82} />
      <Block top={378} height={82} />
      <TabBar hide={0} />
      <Dim />
      <Ring style={{ right: 20, bottom: 106, width: 62, height: 62 }} radius={31} badge={2} badgeAt={{ top: -10, left: -10 }} inner={{ backgroundColor: colors.navy }}>
        <Ionicons name="add" size={32} color="#fff" />
      </Ring>
      <TabRing index={0} left={8} width={82} />
      <Trail d="M96 800 L300 800 Q330 800 330 770 L330 742" />
      {/* + sonrası açılan hazır görev listesinin küçük önizlemesi */}
      <View pointerEvents="none" style={[st.preview]}>
        <View style={st.previewRow}>
          <View style={[st.check, { backgroundColor: colors.navy }]}><Ionicons name="checkmark" size={12} color="#fff" /></View>
          <Text style={st.previewText}>Yatağını topla</Text>
        </View>
        <View style={st.previewRow}>
          <View style={[st.check, { borderWidth: 1.5, borderColor: colors.faint }]} />
          <Text style={st.previewText}>Kitap oku</Text>
        </View>
        <View style={st.previewBtn}><Text style={{ fontSize: 13, fontWeight: '700', color: '#fff' }}>Devam</Text></View>
      </View>
      <Coach {...p} title="Görev ver" text="Görevler, sonra +" style={{ left: 20, right: 20, top: 190 }} />
    </>
  );
}

/* ---------- 4 · İncele ve onayla: İnceleme → Onayla ---------- */

function Step4(p: StepProps) {
  return (
    <>
      <Text style={{ position: 'absolute', left: 20, top: 54, fontSize: 26, fontWeight: '800', color: colors.navy }}>İnceleme</Text>
      <Block top={110} height={140} style={{ padding: 16, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={[st.avatar, { width: 40, height: 40, borderRadius: 20, backgroundColor: CHILD[0] }]}><Text style={{ fontWeight: '800', color: CHILD[1] }}>N</Text></View>
          <View style={{ gap: 2 }}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.navy }}>Dişlerini fırçala</Text>
            <Text style={{ fontSize: 12, color: '#5B6274' }}>Nazlı · Kolay · 5</Text>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1, height: 44, borderRadius: 12, backgroundColor: '#F1F2F6', alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 14, fontWeight: '700', color: colors.navy }}>Reddet</Text>
          </View>
          <View style={{ flex: 1 }} />
        </View>
      </Block>
      <Block top={264} height={110} />
      <TabBar hide={1} />
      <Dim />
      <Trail d="M146 744 L146 712 Q146 700 158 700 L352 700 Q366 700 366 686 L366 242 Q366 228 352 228" />
      <Ring style={{ left: 200, right: 36, top: 202, height: 44 }} radius={12} badge={2} badgeAt={{ top: -12, right: -12 }} inner={{ backgroundColor: colors.navy }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#fff' }}>Onayla</Text>
      </Ring>
      <TabRing index={1} left={106} width={80} />
      <Coach {...p} title="Yaptı mı? Onayla" text="Onaylayınca ödülünü kazanır" style={{ left: 20, width: 300, top: 400 }} />
    </>
  );
}

/* ---------- 5 · Uzmanını ekle (isteğe bağlı): Aile → Hesap → Uzmanım ---------- */

const ACCOUNT = ['Üyelik', 'Hesabı yönet', 'Kod gir', 'Bildirimler', '', 'Geri bildirim gönder'];

function Step5({ onNext, step, total }: StepProps) {
  return (
    <>
      <Avatar x={20} letter="A" label="Anne" tint={ANNE} />
      <Avatar x={90} letter="N" label="Nazlı" tint={CHILD} />
      <Segments hide={2} />
      <Block top={186} height={324}>
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
  previewBtn: { height: 34, borderRadius: 10, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
});
