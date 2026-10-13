# Fidan – Ebeveyn Uygulaması (iOS + Android, Expo)

## Kurulum (bilgisayarında bir kez)

1. Node.js (LTS) kur: https://nodejs.org
2. Telefonuna **Expo Go** uygulamasını indir (App Store / Google Play).
3. Terminalde:

```bash
npx create-expo-app@latest fidan --template blank-typescript
cd fidan
npx expo install @react-navigation/native @react-navigation/bottom-tabs @react-navigation/native-stack react-native-screens react-native-safe-area-context @react-native-community/datetimepicker expo-clipboard @expo/vector-icons
npx expo install @supabase/supabase-js @react-native-async-storage/async-storage react-native-url-polyfill expo-linking
npx expo install expo-image-picker expo-audio expo-file-system
```

4. Bu depodaki **App.tsx** dosyasını, **src/** ve **assets/avatars/** klasörlerini, **.env.example** ve **.gitignore** dosyalarını proje klasörüne kopyala (var olan App.tsx'in üzerine yaz).
5. Supabase'i bağla:
   - https://supabase.com üzerinde yeni proje aç.
   - Panelde **SQL Editor > New query**: `supabase/migrations/20261013000000_init.sql` dosyasının tamamını yapıştır, **Run**. (Boş projede bir kez çalıştırılır; tabloları, Row Level Security kurallarını, kod/hesap silme fonksiyonlarını, Realtime ve `mail` Storage kovasını kurar.)
   - `.env.example` dosyasını `.env` adıyla kopyala; **Project Settings > API** sayfasındaki proje URL'sini ve *publishable* (anon) anahtarı yaz. `.env` git'e eklenmez. `service_role`/secret anahtarı uygulamaya asla yazılmaz.
   - E-posta, yönlendirme adresleri ve Türkçe e-posta şablonları için **[docs/SUPABASE.md](docs/SUPABASE.md)** dosyasındaki adımları uygula.
   - Proje klasöründeki `app.json` içinde `"expo"` altına şunları ekle (deep link ve Türkçe izin metinleri; Expo Go'da gerekmez ama derlenmiş uygulamada gerekir):

     ```json
     "scheme": "fidan",
     "plugins": [
       ["expo-image-picker", { "photosPermission": "Çocuğuna fotoğraf göndermek için galerine erişim gerekiyor." }],
       ["expo-audio", { "microphonePermission": "Sesli mesaj kaydetmek için mikrofona erişim gerekiyor." }]
     ]
     ```
6. Çalıştır:

```bash
npx expo start
```

Çıkan QR kodu telefonunla okut. Uygulama Expo Go içinde açılır.

> Not: Veriler Supabase'de kalıcı tutulur (`src/store.tsx`). Ekranlar değişikliği anında gösterir, kayıt arka planda yapılır; hata olursa uyarı çıkar ve veri sunucudan yeniden yüklenir. Diğer ebeveynin ve çocuk uygulamasının değişiklikleri Realtime ile anında gelir.

## Neler var

- **Görevler**: Tek sayfada kaydırmalı haftalık takvim (ay/yıl başlıkta, bugün hafif renkli, seçili gün lacivert), çocuğa göre filtre, tamamlananlar ayrı ve soluk, sağ altta büyük + butonu. Satıra dokununca düzenleme açılır. Silme yalnızca düzenleme ekranının en altında ve onay ister (yanlışlıkla silinmez).
- **Tekrarlayan görev**: Tek kayıt tutulur; bir kez düzenlemek tüm günlere yansır.
- **Görev Oluştur**: Arama, kategori filtreleri, Kaydedilenler, çoklu seçim, "kaç ebeveyn kullandı" bilgisi (lacivert), kolay/orta/zor ve beceri etiketi, "Aradığını bulamadın mı?" + büyük "+" ile yeni görev.
- **Görev ayrıntıları**: Çocuk başına zorluk ve coin, başlangıç tarihi, tek seferlik/tekrarlayan, hatırlatma, inceleme, özel görevi şablon olarak kaydetme. Geçmiş güne atamada uyarı çıkar ve görev o günde görünür.
- **Aile**: Ben + çocuk avatarları, lacivert + butonu aynı hizada; Genel / Posta / Hesap; alttan açılan tek "Ekle" sayfası (çocuk: avatar, isim, cinsiyet, doğum günü; ebeveyn: benzersiz davet kodu, kopyala ve paylaş simgeleri); Profilim düzenleme; Posta; Hesap listesi ve Çıkış Yap.
- **Gelişim** ve **İnceleme** (onayla/reddet).
- **Hesap**: Kayıt ol, giriş yap, şifremi unuttum (e-postadaki bağlantı uygulamayı açar, yeni şifre belirlenir), Çıkış Yap, Hesabı yönet > Hesabı sil.
- **Kodlar**: İkinci ebeveyn davet kodu (Aile > Hesap > Aileye katıl) ve çocuk giriş kodu (çocuğun Genel sekmesi); tek kullanımlık, 24 saat geçerli.
- **Posta**: Yazı, fotoğraf ve sesli mesaj; Realtime ile anında gelir.
- **Avatarlar**: Çizim görseller için hazır (`assets/avatars/README.md`); görsel eklenene kadar emoji görünür.

## Sıradaki adımlar

1. Çizim avatar görsellerini `assets/avatars/` altına ekle.
2. Çocuk uygulaması (giriş kodu altyapısı hazır, bkz. `docs/SUPABASE.md` §8).
3. Push bildirimleri.
4. App Store hazırlığı (aşağıda).

## App Store için şimdiden bilinmesi gerekenler

- Çocuklara yönelik olduğu için **Kids Category** kuralları geçerli: üçüncü taraf reklam/analitik yok, ebeveyn kapısı (parental gate) olmadan dış bağlantı ve satın alma yok.
- **Uygulama içinden hesap silme** zorunlu (Hesabı yönet içine eklenecek).
- Herkese açık **gizlilik politikası URL'si** ve App Store Connect'te "App Privacy" formu gerekir. Çocuk verisi için KVKK/COPPA metni hazırlanmalı.
- Apple Developer hesabı (yıllık ücretli) ve EAS Build ile derleme gerekir.
- Giriş zorunluysa App Review için çalışan bir demo hesap verilmeli.
