import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, Alert, StyleSheet, ActivityIndicator, Animated, Easing, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { colors, radius } from '../theme';
import { Avatar } from '../components/ui';
import DateField from '../components/DateField';
import Info from '../components/Info';
import CodeEntry, { CodeResult } from '../components/CodeEntry';
import { useStore } from '../store';
import { useAuth } from '../lib/auth';
import { track } from '../lib/track';
import { childAvatars, parentAvatars } from '../data/avatars';
import { HEALTH_CONSENT_TEXT, Step, childSteps, familySteps, relateSteps } from '../data/intake';
import { myAnswers, saveAnswer } from '../lib/intake';
import { openInvite, pendingInvites } from '../lib/clinic';
import { clearPendingClinicInvite, getPendingClinicInvite } from '../lib/clinicInvite';
import { hintOf } from '../lib/errors';
import { useSetup } from '../setupContext';
import ChildAvatarPicker, { LocalPhoto } from '../components/ChildAvatarPicker';
import { uploadChildPhoto } from '../lib/avatarPhoto';

// İlk kurulum (kullanıcı kararları 27 Ekim 2026; ortak/sozlesme/akislar.md 16):
// aile soruları → sıradaki (çocuğunu ekle / kodla katıl) → çocuk (uzman daveti ya da form) → çocuk soruları → çocukların
// → hazırlanıyor → seni nasıl görsün → tanıdık mı ×3 → uygulama. Eşinin koduyla katılan çocuk adımlarını görmez.
type Phase = 'family' | 'next' | 'join' | 'childForm' | 'child' | 'children' | 'loading' | 'nickname' | 'relate';

export default function SetupScreen({ navigation, route }: any) {
  const { children } = useStore();
  const { finish } = useSetup();
  const [phase, setPhase] = useState<Phase>(children.length ? 'children' : 'family');
  const [childId, setChildId] = useState<string | undefined>();
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);

  // Davet ekranından dönüş: eklenen çocuğun soruları
  useEffect(() => {
    const id = route.params?.childId as string | undefined;
    if (id) { setChildId(id); setPhase('child'); navigation.setParams({ childId: undefined }); }
  }, [route.params?.childId]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Çocuğunu ekle": uzman daveti bekliyorsa önerisiyle davet ekranı, yoksa form
  const addChild = async () => {
    setBusy(true);
    try {
      const key = await getPendingClinicInvite();
      if (key) {
        try {
          const r = await openInvite(key);
          await clearPendingClinicInvite();
          if (r.kind === 'pending') return navigation.navigate('Invite', { invite: r.invite, fromSetup: true });
        } catch (e) {
          await clearPendingClinicInvite();
          Alert.alert('Uzman daveti açılamadı', `${(e as Error).message}\n\nÇocuğunu kendin ekleyebilirsin; uzman kodunu sonra Aile › Hesap › Kod gir bölümüne yazabilirsin.`);
        }
      }
      const inv = (await pendingInvites().catch(() => []))[0];
      if (inv) return navigation.navigate('Invite', { invite: inv, fromSetup: true });
      setPhase('childForm');
    } finally {
      setBusy(false);
    }
  };

  const onCode = (r: CodeResult) => {
    if (r.kind === 'invite') return navigation.navigate('Invite', { invite: r.invite, fromSetup: true });
    if (r.kind === 'family') { setJoined(true); setPhase('nickname'); return; }
    Alert.alert('Bu daveti zaten kabul ettin', 'Paylaşım Aile › Hesap › Uzmanım bölümünde.');
  };

  const child = children.find((c) => c.id === childId);
  const done = () => finish(joined ? 'joined' : 'children');

  if (phase === 'family') return <Questionnaire key="family" steps={familySteps} childId={null} onDone={() => setPhase('next')} />;
  if (phase === 'child' && childId) {
    return <Questionnaire key={childId} steps={childSteps(child?.name ?? 'Çocuğun')} childId={childId} onDone={() => setPhase('children')}
      onBackFirst={() => setPhase('children')} />;
  }
  if (phase === 'next') {
    return (
      <Center icon="people-outline" title="Şimdi aileni ekleyelim" text="Sonra başka çocuk da ekleyebilirsin."
        primary={{ label: 'Çocuğunu ekle', onPress: addChild, busy }}
        secondary={{ label: 'Kodla aileye katıl', onPress: () => setPhase('join') }}
        onBack={() => setPhase('family')} />
    );
  }
  if (phase === 'join') {
    return (
      <Shell onBack={() => setPhase('next')}>
        <View style={{ flex: 1, justifyContent: 'center', gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
            <Text style={styles.title}>Kodu yaz</Text>
            <Info title="Hangi kod?" text={'Eşin ParentApp\'te Aile › + › Ebeveyn bölümünden 6 haneli bir kod üretir; bu kodla aynı aileye katılırsın, çocuklar ve görevler ortak olur. Uzmanından kod aldıysan onu da buraya yazabilirsin.'} />
          </View>
          <Text style={[styles.text, { textAlign: 'center' }]}>Eşinden ya da uzmanından aldığın 6 haneli kod</Text>
          <CodeEntry onResult={onCode} autoFocus />
        </View>
      </Shell>
    );
  }
  if (phase === 'childForm') {
    return <ChildForm first={!children.length} onBack={() => setPhase(children.length ? 'children' : 'next')}
      onSaved={(id) => { setChildId(id); setPhase('child'); }} />;
  }
  if (phase === 'children') {
    return <ChildrenList onContinue={() => setPhase('loading')} onAdd={() => setPhase('childForm')} />;
  }
  if (phase === 'loading') return <Loading onDone={() => setPhase('nickname')} />;
  if (phase === 'nickname') return <Nickname onDone={() => setPhase('relate')} />;
  return <Relate onDone={done} />;
}

/* ---------- ortak parçalar ---------- */

function Shell({ children, onBack, progress }: { children: React.ReactNode; onBack?: () => void; progress?: number }) {
  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.top}>
          <View style={{ width: 36 }}>
            {onBack && (
              <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Geri">
                <Ionicons name="chevron-back" size={24} color={colors.navy} />
              </Pressable>
            )}
          </View>
          {progress !== undefined && (
            <View style={styles.track} accessibilityLabel={`İlerleme yüzde ${Math.round(progress * 100)}`}>
              <View style={[styles.fill, { width: `${Math.max(4, Math.round(progress * 100))}%` }]} />
            </View>
          )}
          <View style={{ width: 36 }} />
        </View>
        <View style={{ flex: 1, paddingHorizontal: 20, paddingBottom: 16 }}>{children}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type Btn = { label: string; onPress: () => void; busy?: boolean; disabled?: boolean };
function Center({ icon, title, text, primary, secondary, onBack, progress, info }: {
  icon: keyof typeof Ionicons.glyphMap; title: string; text?: string; primary: Btn; secondary?: Btn; onBack?: () => void; progress?: number; info?: string;
}) {
  return (
    <Shell onBack={onBack} progress={progress}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <View style={styles.icon}><Ionicons name={icon} size={40} color={colors.navy} /></View>
        <Text style={[styles.title, { textAlign: 'center' }]} accessibilityRole="header">{title}</Text>
        {!!text && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 }}>
            <Text style={[styles.text, { textAlign: 'center' }]}>{text}</Text>
            {!!info && <Info title={title} text={info} />}
          </View>
        )}
      </View>
      <View style={{ gap: 10 }}>
        <Cta {...primary} />
        {secondary && <Cta {...secondary} ghost />}
      </View>
    </Shell>
  );
}

function Cta({ label, onPress, busy, disabled, ghost }: Btn & { ghost?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={busy || disabled} accessibilityRole="button" accessibilityState={{ disabled: !!(busy || disabled) }}
      style={[ghost ? styles.ghost : styles.cta, (busy || disabled) && { opacity: 0.45 }]}>
      {busy ? <ActivityIndicator color={ghost ? colors.navy : '#fff'} /> : <Text style={ghost ? styles.ghostText : styles.ctaText}>{label}</Text>}
    </Pressable>
  );
}

/* ---------- soru akışı ---------- */

function Questionnaire({ steps, childId, onDone, onBackFirst }: {
  steps: Step[]; childId: string | null; onDone: () => void; onBackFirst?: () => void;
}) {
  const { session } = useAuth();
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [multi, setMulti] = useState<string[]>([]);
  const advancing = useRef(false);
  const step = steps[i];
  const qCount = steps.filter((s) => s.kind === 'question').length;
  const qIndex = steps.slice(0, i + 1).filter((s) => s.kind === 'question').length;

  useEffect(() => { if (session) myAnswers(session.user.id, childId).then(setAnswers).catch(() => {}); }, [session, childId]);
  useEffect(() => { if (step?.kind === 'question' && step.multi) setMulti(answers[step.key] ?? []); }, [i]); // eslint-disable-line react-hooks/exhaustive-deps

  const next = useCallback(() => {
    advancing.current = false;
    if (i + 1 >= steps.length) onDone(); else setI(i + 1);
  }, [i, steps.length, onDone]);

  const answer = async (values: string[]) => {
    if (step.kind !== 'question' || advancing.current) return;
    advancing.current = true;
    setAnswers((p) => ({ ...p, [step.key]: values }));
    try { await saveAnswer(childId, step.key, values, step.health); }
    catch (e) { Alert.alert('Yanıt kaydedilemedi', (e as Error).message); }
    track('intake.answer', { q: step.key });
    setTimeout(next, step.multi ? 0 : 180);
  };

  if (!step) return null;
  const back = i > 0 ? () => setI(i - 1) : onBackFirst;
  if (step.kind !== 'question') {
    return <Center icon={step.icon as any} title={step.title} text={step.text} primary={{ label: 'Devam', onPress: next }}
      onBack={back} progress={qIndex / qCount} />;
  }
  const chosen = step.multi ? multi : answers[step.key] ?? [];
  const skip = step.exclude ? answers[step.exclude] ?? [] : [];
  const options = step.options.filter((o) => !skip.includes(o.key));
  const toggle = (key: string, exclusive?: boolean) => setMulti((p) => {
    if (exclusive) return p.includes(key) ? [] : [key];
    const base = p.filter((k) => !step.options.find((o) => o.key === k)?.exclusive);
    return base.includes(key) ? base.filter((k) => k !== key) : [...base, key];
  });
  return (
    <Shell onBack={back} progress={qIndex / qCount}>
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 16 }} showsVerticalScrollIndicator={false}>
        {!!step.prefix && <Text style={[styles.text, { textAlign: 'center' }]}>{step.prefix}</Text>}
        <Text style={[styles.title, { textAlign: 'center', marginBottom: 8 }]} accessibilityRole="header">{step.title}</Text>
        {step.multi && <Text style={[styles.cap, { textAlign: 'center' }]}>Uyanların hepsini seç</Text>}
        {options.map((o) => {
          const on = chosen.includes(o.key);
          return (
            <Pressable key={o.key} onPress={() => (step.multi ? toggle(o.key, o.exclusive) : answer([o.key]))}
              accessibilityRole={step.multi ? 'checkbox' : 'button'} accessibilityState={{ checked: on, selected: on }}
              style={[styles.option, on && styles.optionOn]}>
              <Text style={[styles.optionText, on && { color: colors.navy, fontWeight: '700' }]}>{o.label}</Text>
              {step.multi && <View style={[styles.box, on && styles.boxOn]}>{on && <Ionicons name="checkmark" size={14} color="#fff" />}</View>}
            </Pressable>
          );
        })}
        {step.health && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            <Text style={[styles.cap, { flex: 1 }]}>İsteğe bağlı. Yanıt verirsen sağlık bilgisi olarak saklanmasına onay vermiş olursun.</Text>
            <Info title="Sağlık yanıtları" text={HEALTH_CONSENT_TEXT} />
          </View>
        )}
      </ScrollView>
      <View style={{ gap: 8 }}>
        {step.multi && <Cta label="İleri" onPress={() => answer(multi.filter((k) => !skip.includes(k)))} disabled={!multi.some((k) => !skip.includes(k))} />}
        {step.health && <Pressable onPress={next} hitSlop={8} style={{ alignSelf: 'center', paddingVertical: 6 }}>
          <Text style={styles.link}>Bu soruyu atla</Text>
        </Pressable>}
      </View>
    </Shell>
  );
}

/* ---------- çocuk formu ---------- */

function ChildForm({ first, onSaved, onBack }: { first: boolean; onSaved: (id: string) => void; onBack: () => void }) {
  const { addChild, children, familyId } = useStore();
  const [photo, setPhoto] = useState<LocalPhoto | null>(null);
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'kız' | 'erkek' | undefined>();
  const [birthday, setBirthday] = useState<string | undefined>();
  const [avatar, setAvatar] = useState(childAvatars[1].id);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false); // doğum günü seçicisi açıkken Kaydet gizli, seçici görünür kaydırılır
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const save = async () => {
    const nm = name.trim();
    if (!nm) return Alert.alert('Çocuğunun adını yaz');
    const same = children.find((c) => c.name.trim().toLocaleLowerCase('tr') === nm.toLocaleLowerCase('tr'));
    if (same && !(await new Promise<boolean>((res) => Alert.alert(`Kayıtlarında ${same.name} adında bir çocuk var`, 'Aynı çocuğu iki kez eklemek istemiyorsan vazgeç.',
      [{ text: 'Vazgeç', style: 'cancel', onPress: () => res(false) }, { text: 'Yine de ekle', onPress: () => res(true) }])))) return;
    setBusy(true);
    let av = avatar;
    if (photo && familyId) {
      try { av = await uploadChildPhoto(familyId, photo.uri, photo.mime); }
      catch (e) { setBusy(false); return Alert.alert('Fotoğraf yüklenemedi', (e as Error).message); }
    }
    const id = await addChild({ name: nm, avatar: av, gender, birthday });
    setBusy(false);
    if (id) onSaved(id);
  };
  return (
    <Shell onBack={onBack}>
      <ScrollView ref={scroll} contentContainerStyle={{ gap: 14, paddingBottom: 16 }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.title, { textAlign: 'center' }]} accessibilityRole="header">{first ? 'İlk çocuğunu ekle' : 'Çocuk ekle'}</Text>
        <View>
          <Text style={styles.label}>Adı</Text>
          <TextInput value={name} onChangeText={setName} maxLength={40} placeholder="Çocuğunun adı" placeholderTextColor={colors.muted} style={styles.input} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {([['kız', 'Kız'], ['erkek', 'Erkek']] as const).map(([k, l]) => (
            <Pressable key={k} onPress={() => setGender(gender === k ? undefined : k)} style={[styles.chip, gender === k && styles.chipOn]}
              accessibilityState={{ selected: gender === k }}>
              <Text style={[styles.chipText, gender === k && { color: '#fff' }]}>{l}</Text>
            </Pressable>
          ))}
        </View>
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.label}>Doğum günü (isteğe bağlı)</Text>
            <Info title="Doğum günü" text="Yaşına uygun görev ve rutin önermek ve oyunun dilini ayarlamak için kullanılır." />
          </View>
          <DateField mode="date" value={birthday} onChange={setBirthday} placeholder="Tarih seç" clearable maximumDate={new Date()}
            onOpenChange={(o) => { setPicking(o); if (o) setTimeout(() => scroll.current?.scrollTo({ y: 180, animated: true }), 60); }} />
        </View>
        <View>
          <Text style={styles.label}>Avatar: fotoğraflarından seç ya da bir simge</Text>
          <View style={{ paddingVertical: 4 }}>
            <ChildAvatarPicker avatar={avatar} photo={photo} onAvatar={setAvatar} onPhoto={setPhoto} />
          </View>
        </View>
      </ScrollView>
      {!picking && (
        <>
          <Cta label="Kaydet" onPress={save} busy={busy} disabled={!name.trim()} />
          {/* veli beyanı (hukuk/50 §1.4) */}
          <Text style={{ fontSize: 11, lineHeight: 16, color: colors.muted, textAlign: 'center' }}>Çocuğu ekleyerek velisi ya da yasal temsilcisi olduğunu beyan edersin. Doğum günü ve cinsiyet isteğe bağlıdır.</Text>
        </>
      )}
    </Shell>
  );
}

/* ---------- çocukların ---------- */

function ChildrenList({ onContinue, onAdd }: { onContinue: () => void; onAdd: () => void }) {
  const { children, renameChild } = useStore();
  const [edit, setEdit] = useState<string | undefined>();
  const [draft, setDraft] = useState('');
  return (
    <Shell>
      <ScrollView contentContainerStyle={{ gap: 10, paddingTop: 24 }} keyboardShouldPersistTaps="handled">
        <View style={[styles.icon, { alignSelf: 'center' }]}><Ionicons name="heart-outline" size={40} color={colors.navy} /></View>
        <Text style={[styles.title, { textAlign: 'center', marginBottom: 8 }]} accessibilityRole="header">Çocukların</Text>
        {children.map((c) => (
          <View key={c.id} style={styles.option}>
            <Avatar id={c.avatar} size={36} />
            {edit === c.id ? (
              <TextInput value={draft} onChangeText={setDraft} autoFocus maxLength={40} style={[styles.optionText, { paddingVertical: 0 }]}
                onEndEditing={() => { renameChild(c.id, draft); setEdit(undefined); }} />
            ) : (
              <Text style={[styles.optionText, { fontWeight: '700' }]}>{c.name}</Text>
            )}
            <Pressable onPress={() => { setEdit(c.id); setDraft(c.name); }} hitSlop={10} accessibilityLabel={`${c.name} adını düzenle`}>
              <Ionicons name="create-outline" size={20} color={colors.navy} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
      <View style={{ gap: 10 }}>
        <Text style={[styles.cap, { textAlign: 'center' }]}>Sonra başka çocuk da ekleyebilirsin</Text>
        <Cta label="Devam" onPress={onContinue} disabled={!children.length} />
        <Cta label="Başka çocuk ekle" onPress={onAdd} ghost />
      </View>
    </Shell>
  );
}

/* ---------- hazırlanıyor ---------- */

function Loading({ onDone }: { onDone: () => void }) {
  const p = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(p, { toValue: 1, duration: 1500, easing: Easing.out(Easing.quad), useNativeDriver: false }).start(() => onDone());
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <Shell>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
        <View style={styles.icon}><Ionicons name="search-outline" size={40} color={colors.navy} /></View>
        <Text style={[styles.title, { textAlign: 'center' }]}>Her çocuk için odak alanlarını belirliyoruz</Text>
        <View style={[styles.track, { flex: 0, width: '80%' }]}>
          <Animated.View style={[styles.fill, { width: p.interpolate({ inputRange: [0, 1], outputRange: ['4%', '100%'] }) }]} />
        </View>
      </View>
    </Shell>
  );
}

/* ---------- çocuğun seni nasıl görsün ---------- */

function Nickname({ onDone }: { onDone: () => void }) {
  const { parent, updateParent } = useStore();
  const [nick, setNick] = useState(parent.nickname && parent.nickname !== 'Ben' ? parent.nickname : '');
  const [avatar, setAvatar] = useState(parent.avatar);
  const save = () => {
    if (!nick.trim()) return Alert.alert('Takma adını yaz', 'Örneğin Anne, Baba, Teyze.');
    updateParent({ nickname: nick.trim(), avatar });
    onDone();
  };
  return (
    <Shell>
      <ScrollView contentContainerStyle={{ gap: 14, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
        <View style={{ alignSelf: 'center' }}><Avatar id={avatar} size={88} ring /></View>
        <Text style={[styles.title, { textAlign: 'center' }]} accessibilityRole="header">Çocuğun seni oyunda nasıl görsün?</Text>
        <View>
          <Text style={styles.label}>Takma adın</Text>
          <TextInput value={nick} onChangeText={setNick} maxLength={20} placeholder="Örn. Anne" placeholderTextColor={colors.muted} style={styles.input} />
        </View>
        <View>
          <Text style={styles.label}>Avatarın</Text>
          <View style={{ flexDirection: 'row', gap: 16 }}>
            {parentAvatars.map((a) => (
              <Pressable key={a.id} onPress={() => setAvatar(a.id)} accessibilityLabel={a.name} accessibilityState={{ selected: avatar === a.id }}>
                <Avatar id={a.id} size={72} ring={avatar === a.id} />
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
      <Cta label="İleri" onPress={save} disabled={!nick.trim()} />
    </Shell>
  );
}

/* ---------- tanıdık geliyor mu ×3 ---------- */

const scenes: Record<'remind' | 'chart' | 'tired', { bg: string; icons: (keyof typeof Ionicons.glyphMap)[] }> = {
  remind: { bg: '#FDE9D9', icons: ['chatbubble-ellipses-outline', 'repeat-outline', 'game-controller-outline'] },
  chart: { bg: '#E6F4EA', icons: ['calendar-outline', 'star-outline', 'trending-down-outline'] },
  tired: { bg: '#E6EAF5', icons: ['moon-outline', 'battery-dead-outline', 'cafe-outline'] },
};

function Relate({ onDone }: { onDone: () => void }) {
  const [i, setI] = useState(0);
  const [busy, setBusy] = useState(false);
  const r = relateSteps[i];
  const sc = scenes[r.scene];
  const pick = async (v: 'yes' | 'no') => {
    if (busy) return;
    setBusy(true);
    try { await saveAnswer(null, r.key, [v]); } catch { /* bir sonraki kurulumda tekrar sorulmaz; geç */ }
    setBusy(false);
    if (i + 1 < relateSteps.length) setI(i + 1); else onDone();
  };
  return (
    <Shell onBack={i > 0 ? () => setI(i - 1) : undefined} progress={(i + 1) / relateSteps.length}>
      <View style={{ flex: 1, gap: 16, justifyContent: 'center' }}>
        <Text style={[styles.title, { textAlign: 'center' }]} accessibilityRole="header">Bu cümle sana tanıdık geliyor mu?</Text>
        <View style={[styles.scene, { backgroundColor: sc.bg }]}>
          <Text style={styles.quote}>“{r.quote}”</Text>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 18, paddingVertical: 24 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {sc.icons.map((ic, k) => (
              <View key={ic} style={[styles.sceneIcon, k === 1 && { transform: [{ translateY: -10 }] }]}>
                <Ionicons name={ic} size={34} color={colors.navy} />
              </View>
            ))}
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Cta label="Hayır" onPress={() => pick('no')} ghost busy={busy} /></View>
        <View style={{ flex: 1 }}><Cta label="Evet" onPress={() => pick('yes')} busy={busy} /></View>
      </View>
    </Shell>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10, minHeight: 48 },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: '#DDE1EA', overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.navy },
  icon: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.today, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: colors.navy, lineHeight: 29 },
  text: { fontSize: 15, color: '#4A5165', lineHeight: 21 },
  cap: { fontSize: 12, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.muted, marginBottom: 6 },
  link: { fontSize: 14, fontWeight: '600', color: colors.navy },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 54, paddingHorizontal: 16, paddingVertical: 12, borderRadius: radius.md, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#fff' },
  optionOn: { borderColor: colors.navy, backgroundColor: '#F1F3FA' },
  optionText: { flex: 1, fontSize: 15, color: colors.navy },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: colors.faint, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  input: { backgroundColor: '#fff', borderRadius: radius.sm, paddingHorizontal: 14, paddingVertical: 13, fontSize: 16, color: colors.navy },
  chip: { paddingHorizontal: 18, height: 40, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  chipOn: { backgroundColor: colors.navy, borderColor: colors.navy },
  chipText: { fontSize: 14, fontWeight: '600', color: colors.navy },
  cta: { height: 52, borderRadius: radius.md, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  ghost: { height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  ghostText: { color: colors.navy, fontSize: 16, fontWeight: '700' },
  scene: { borderRadius: radius.lg, padding: 20 },
  quote: { fontSize: 18, fontWeight: '700', color: '#4A2B12', textAlign: 'center', lineHeight: 25 },
  sceneIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.75)', alignItems: 'center', justifyContent: 'center' },
});
