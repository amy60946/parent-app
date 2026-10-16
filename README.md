# Fidan – Ebeveyn Uygulaması (iOS + Android, Expo)

## Kurulum

Depo, doğrudan çalışan bir Expo projesidir (Expo SDK 57). Uygulama adı **Fidan**, uygulama kimliği `com.fidan.parentapp`, Expo hesabı `amy60946`.

1. Supabase'i bağla (bir kez):
   - Panelde **SQL Editor > New query**: `supabase/migrations/` altındaki dosyaları sırayla (önce `20261013000000_init.sql`, sonra `20261014000000_task_repeat_order.sql`) yapıştır, **Run**.
   - Çocuk girişi için **Authentication > Sign In / Providers > Anonymous Sign-Ins** açık olmalı.
   - E-posta, yönlendirme adresleri ve Türkçe e-posta şablonları: **[docs/SUPABASE.md](docs/SUPABASE.md)**.
2. `.env.example` dosyasını `.env` adıyla kopyala; Supabase proje adresini ve *publishable* (anon) anahtarı yaz. `.env` git'e eklenmez; `service_role`/secret anahtar uygulamaya asla yazılmaz. Expo'nun bulutta derlediği sürümler için aynı iki değer expo.dev'deki proje ayarlarına (Environment variables) girilir.
3. Bilgisayarda çalıştırmak için (Node.js gerekir):

```bash
npm install
npx expo start
```

Çıkan QR kodu telefondaki **Expo Go** ile okut.

- Ayarlar: `app.json` (ad, kimlik, simge, açılış ekranı, Türkçe izin metinleri, `fidan://` bağlantıları), `eas.json` (Expo bulut derleme profilleri).
- Geçici simge: `assets/icon.png` (lacivert zeminde fidan). Asıl tasarım gelince aynı adla değiştirilir.
- Tip kontrolü: `npm run typecheck`

> Not: Veriler Supabase'de kalıcı tutulur (`src/store.tsx`). Ekranlar değişikliği anında gösterir, kayıt arka planda yapılır; hata olursa uyarı çıkar ve veri sunucudan yeniden yüklenir. Diğer ebeveynin ve çocuk uygulamasının değişiklikleri Realtime ile anında gelir.

## Neler var

- **Görevler**: Ebeveyn paneli; kaydırmalı haftalık takvim, çocuğa göre filtre, sağ altta büyük + butonu. Görevi ebeveyn tamamlamaz (çocuk uygulaması işaretler, ebeveyn İnceleme'den onaylar); satırda yalnızca durum etiketi görünür (Onay bekliyor / Tamamlandı). Satıra ya da kalem simgesine dokununca düzenleme açılır; basılı tutup sürükleyerek sıralanır (sol tutamaç); sola kaydırınca Sil çıkar (onay ister).
- **Tekrarlayan görev**: Tek kayıt tutulur; bir kez düzenlemek tüm günlere yansır. Her gün / haftanın seçilen günleri (haftada kaç gün) / ayın seçilen günleri (ayda kaç kez).
- **Görev Oluştur**: Arama, sabit yükseklikte yatay kaydırılan filtreler (Tümü, Kaydedilenler + sayısı, kategoriler), çoklu seçim, "kaç ebeveyn kullandı" bilgisi, kolay/orta/zor ve beceri etiketi, "Aradığını bulamadın mı?" + büyük "+" ile yeni görev.
- **Görev ayrıntıları**: Çocuk başına zorluk ve coin, başlangıç tarihi, tek seferlik/tekrarlayan, hatırlatma, inceleme, özel görevi şablon olarak kaydetme. Geçmiş güne atamada uyarı çıkar ve görev o günde görünür.
- **Aile**: Ben + çocuk avatarları, lacivert + butonu; Genel / Posta / Hesap; alttan açılan "Ekle" sayfası klavye açılınca yukarı kayar (çocuk: avatar, isim, cinsiyet, doğum günü; ebeveyn: davet kodu); Profilim düzenleme; Hesap listesi ve Çıkış Yap.
- **Gelişim** ve **İnceleme** (onayla/reddet).
- **Giriş**: Açılış ekranı çocuk içindir: masalsı tam ekran sahne (vektör çizim, `src/components/FairyScene.tsx`) ve yalnızca 6 haneli sihirli kod alanı. Altındaki küçük "Ebeveyn olarak giriş yap" bağlantısı e-posta/şifre ekranını açar. Çocuk koduyla girince şimdilik "oyun yakında" ekranı görünür.
- **Hesap**: Kayıt ol, giriş yap, şifremi unuttum (e-postadaki bağlantı uygulamayı açar, yeni şifre belirlenir), Çıkış Yap, Hesabı yönet > Hesabı sil.
- **Kodlar**: İkinci ebeveyn davet kodu (Aile > Hesap > Aileye katıl) ve çocuk giriş kodu (çocuğun Genel sekmesi); tek kullanımlık, 24 saat geçerli.
- **Posta**: Çocuk listesi (son mesaj önizlemesi) → tam ekran sohbet; gün ayraçları, saatli baloncuklar, klavyenin üstünde kalan yazı alanı. Yazı, fotoğraf ve sesli mesaj; Realtime ile anında gelir.
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

## Web önizlemesi (deneme veritabanıyla)

Uygulama Claude sohbetinde tıklanabilir bir sayfa olarak da açılır. Bu sayfa dış sunuculara bağlanamadığı için gerçek Supabase yerine tarayıcıda çalışan bir deneme veritabanı (`preview/demo-supabase.ts`) kullanır; veriler o tarayıcıda saklanır. Hazır hesap: `demo@fidan.app` / `12345678`.

- Üretmek için: `bash preview/build.sh` → `preview/out/index.html` + `app.html`
- `src/lib/webAlert.web.ts`, `src/components/DateField.web.tsx`, `src/lib/files.web.ts` yalnızca web'de devreye girer; telefondaki davranış değişmez.
