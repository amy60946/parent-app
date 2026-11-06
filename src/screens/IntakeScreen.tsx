import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, Alert } from 'react-native';
import { Questionnaire } from './SetupScreen';
import { familySteps, childSteps } from '../data/intake';
import { intakeStatus } from '../lib/intake';
import { resetPlan } from '../lib/plan';
import { useAuth } from '../lib/auth';
import { useStore } from '../store';
import { track } from '../lib/track';
import { colors } from '../theme';

// Ben › "Tanışma sorularını tamamla" (kullanıcı isteği 28 Ekim 2026): uzman davetiyle gelen aile kurulumda soruları atlar;
// burada kurulumdaki ekranların aynısıyla önce aile, sonra yanıtı olmayan çocukların soruları. Yarıda kapatılırsa
// verilen yanıtlar kalır, satır Ben'de yine görünür.
export default function IntakeScreen({ navigation }: any) {
  const { session } = useAuth();
  const { children } = useStore();
  const [queue, setQueue] = useState<(string | null)[] | null>(null); // null = aile, id = çocuk
  const [i, setI] = useState(0);

  useEffect(() => {
    if (!session) return;
    intakeStatus(session.user.id).then((st) => {
      const q: (string | null)[] = [];
      if (!st.family) q.push(null);
      for (const c of children) if (!st.children.includes(c.id)) q.push(c.id);
      if (!q.length) { navigation.goBack(); return; }
      setQueue(q);
    }).catch(() => navigation.goBack());
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!queue) return <View style={{ flex: 1, backgroundColor: colors.bg, justifyContent: 'center' }}><ActivityIndicator color={colors.navy} /></View>;

  const id = queue[i];
  const next = () => {
    if (i + 1 < queue.length) return setI(i + 1);
    resetPlan(); // yanıtlar kişisel plana yeniden okunur
    track('intake.later_done', { n: queue.length });
    navigation.goBack();
    Alert.alert('Teşekkürler', 'Rutin önerileri artık ailene göre sıralanıyor.');
  };
  const name = children.find((c) => c.id === id)?.name ?? 'Çocuğun';
  return (
    <Questionnaire key={id ?? 'family'} steps={id ? childSteps(name) : familySteps} childId={id} onDone={next}
      onBackFirst={() => (i > 0 ? setI(i - 1) : navigation.goBack())} />
  );
}
