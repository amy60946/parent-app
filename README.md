# Fidan – Ebeveyn Uygulaması (iOS + Android, Expo)

## Kurulum (bilgisayarında bir kez)

1. Node.js (LTS) kur: https://nodejs.org
2. Telefonuna **Expo Go** uygulamasını indir (App Store / Google Play).
3. Terminalde:

```bash
npx create-expo-app@latest fidan --template blank-typescript
cd fidan
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context @react-native-community/datetimepicker expo-clipboard @expo/vector-icons
```

4. Bu zip'teki **App.tsx** dosyasını ve **src/** klasörünü proje klasörüne kopyala (var olan App.tsx'in üzerine yaz).
5. Çalıştır:

```bash
npx expo start
```

Çıkan QR kodu telefonunla okut. Uygulama Expo Go içinde açılır.

> Not: Bu sürümde veriler telefonda geçici tutulur (uygulamayı kapatınca sıfırlanır). Supabase bağlanınca kalıcı olacak.

## Neler var

- **Görevler**: Tek sayfada kaydırmalı haftalık takvim (ay/yıl başlıkta, bugün hafif renkli, seçili gün lacivert), çocuğa göre filtre, tamamlananlar ayrı ve soluk, sağ altta büyük + butonu. Satıra dokununca düzenleme açılır. Silme yalnızca düzenleme ekranının en altında ve onay ister (yanlışlıkla silinmez).
- **Tekrarlayan görev**: Tek kayıt tutulur; bir kez düzenlemek tüm günlere yansır.
- **Görev Oluştur**: Arama, kategori filtreleri, Kaydedilenler, çoklu seçim, "kaç ebeveyn kullandı" bilgisi (lacivert), kolay/orta/zor ve beceri etiketi, "Aradığını bulamadın mı?" + büyük "+" ile yeni görev.
- **Görev ayrıntıları**: Çocuk başına zorluk ve coin, başlangıç tarihi, tek seferlik/tekrarlayan, hatırlatma, inceleme, özel görevi şablon olarak kaydetme. Geçmiş güne atamada uyarı çıkar ve görev o günde görünür.
- **Aile**: Ben + çocuk avatarları, lacivert + butonu aynı hizada; Genel / Posta / Hesap; alttan açılan tek "Ekle" sayfası (çocuk: avatar, isim, cinsiyet, doğum günü; ebeveyn: benzersiz davet kodu, kopyala ve paylaş simgeleri); Profilim düzenleme; Posta; Hesap listesi ve Çıkış Yap.
- **Gelişim** ve **İnceleme** (onayla/reddet).

## Sıradaki adımlar

1. Supabase: kayıt, giriş, şifremi unuttum, hoş geldin e-postası, kalıcı veri.
2. Çizim hayvan avatarları (`src/data/avatars.ts` içindeki `image` alanı hazır).
3. Fotoğraf ve sesli mesaj, push bildirimleri.
4. App Store hazırlığı (aşağıda).

## App Store için şimdiden bilinmesi gerekenler

- Çocuklara yönelik olduğu için **Kids Category** kuralları geçerli: üçüncü taraf reklam/analitik yok, ebeveyn kapısı (parental gate) olmadan dış bağlantı ve satın alma yok.
- **Uygulama içinden hesap silme** zorunlu (Hesabı yönet içine eklenecek).
- Herkese açık **gizlilik politikası URL'si** ve App Store Connect'te "App Privacy" formu gerekir. Çocuk verisi için KVKK/COPPA metni hazırlanmalı.
- Apple Developer hesabı (yıllık ücretli) ve EAS Build ile derleme gerekir.
- Giriş zorunluysa App Review için çalışan bir demo hesap verilmeli.
