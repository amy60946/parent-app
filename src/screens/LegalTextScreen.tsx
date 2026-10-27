import React from 'react';
import { Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LegalTextView } from '../components/LegalText';

// Yasal metin (route LegalText: { key, version? }): kayıt, yeniden onay, Yasal metinler, KVKK, hesap silme ve
// abonelik ekranlarındaki bağlantılar buraya açılır. iOS'ta sayfa kartı (modal) olduğundan üst boşluk gerekmez.
export default function LegalTextScreen({ navigation, route }: any) {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }} edges={Platform.OS === 'ios' ? ['bottom'] : ['top', 'bottom']}>
      <LegalTextView docKey={route.params?.key} version={route.params?.version} onClose={() => navigation.goBack()} />
    </SafeAreaView>
  );
}
