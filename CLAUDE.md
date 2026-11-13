# ParentApp — Claude için çalışma notları

ParentApp, ebeveynin kullandığı uygulama (Expo / React Native, TypeScript). Üç üründen biri; üçü ayrı uygulama, **tek Supabase projesi**:

| Ürün | Kim | Depo |
|---|---|---|
| Pofi Adası (GameApp) | Çocuk | `amy60946/game-app` (Unity) |
| **ParentApp** | Ebeveyn (aile aboneliği) | `amy60946/parent-app` (bu depo) |
| ClinicApp | Uzman (klinisyen başına ücret) | `amy60946/clinic-app` |

## Ortak kaynak: `amy60946/ortak`

- Veritabanı şeması, RPC'ler, durum adları, coin/XP kuralları ve karar günlüğü **`ortak`** deposundadır. Oturuma eklenmemişse kullanıcıya söyle.
- Her işe başlamadan önce `ortak/CLAUDE.md`, `ortak/DURUM.md` ve ilgili `ortak/sozlesme/*` dosyasını oku.
- Ortak bir şey değişecekse önce `ortak` güncellenir (SQL `proposed/` + test + sözleşme + DURUM satırı), sonra bu uygulama. Bu depodaki `supabase/` klasörü **eski kopyadır**, yeni SQL buraya yazılmaz.
- Oturum sonunda `ortak/DURUM.md`'ye bir satır yaz.

## Kullanıcı ve iletişim

- Kullanıcı yazılımcı değil: **Türkçe**, sade dille, adım adım ve nereye tıklayacağını söyleyerek anlat. Belirsiz kararda kısa soru sor; kapsam dışına çıkma.
- Şifre/anahtar sohbete yapıştırılmaz; GitHub Secrets'a eklenir. Uygulamaya yalnız Supabase publishable anahtarı girer (`EXPO_PUBLIC_SUPABASE_KEY`, CI'da `SUPABASE_PUBLISHABLE_KEY` secret'ından `.env`). `sb_secret_` / `service_role` asla.
- Push yalnız oturumun `claude/...` dalına; kullanıcı istemedikçe PR açılmaz.
- "Fidan" adı hiçbir yerde kullanılmaz. **Görünen ad Moyo** (kullanıcı kararı 9 Kasım 2026: telefonda simgenin altında, uygulama içi yazılarda, tanıtım sitesinde ve davet sayfasında; `app.json` `name`). **Marka (13 Kasım 2026):** logo küçük harf "moyo" ("C Top, ayarlı"), uygulama simgesi iki satırlı "mo / yo" (koyu zemin #16113A, yeşil harf #0FD354, beyaz top); kit `brand/` (README orada), simge / açılış / site görselleri `python3 brand/app_assets.py` ile üretilir, elle düzenlenmez. İç ad (depo, belgeler, ortak sözleşme) ParentApp; bundle `com.parentapp.ios` ve şema `parentapp://` değişmez. Oyundaki karakter **Okti**. Türkçe eklerle: Moyo'yu, Moyo'ya, Moyo'dan, Moyo'da, Moyo'nun.

## Teknik notlar

- Doğrulama: `npx tsc --noEmit`. Web önizleme: `preview/` (deneme veritabanı `preview/demo-supabase.ts`).
- iOS/TestFlight: `.github/workflows/ios-testflight.yml` → `tools/ci/ios-testflight.sh` (macos-15, Xcode 26 zorunlu; `expo prebuild` + xcodebuild). GitHub'da Apple işlemcili Mac kapasitesi dolarsa iş 15 dk kuyrukta bekleyip "not acquired by Runner" ile düşer (gerekçe iş notlarında: check-run annotations); o zaman elle başlatmada `runner: macos-15-intel` seçilir.
  İmza: arşiv otomatik geliştirme imzası (`tools/ci/asc_device.py` gerekirse yer tutucu cihaz kaydeder), dışa aktarma **elle App Store dağıtım imzası** (`tools/ci/asc_sign.py`: geçici sertifika + profil, iş sonunda iptal; kullanıcı onayı 19 Ekim 2026). Xcode bulut imzası "Invalid Signature" verdiği için kullanılmaz.
  Arşivden önce `asc_sign.py prune_dev`, CI'ın birikmiş geliştirme sertifikalarını ("Created via API") iptal eder (kullanıcı onayı 19 Ekim 2026). Xcode'un JS paketleme adımı `.env`'i okumadığı için Supabase değerleri ayrıca ortam değişkeni olarak verilir; derleme başında ve arşivden sonra JS paketinde sunucu adresi denetlenir.
  Secret'lar: `SUPABASE_PUBLISHABLE_KEY`, `ASC_KEY_ID`, `ASC_ISSUER_ID`, `ASC_KEY_P8`, `APPLE_TEAM_ID`, isteğe bağlı `EXPO_PUBLIC_REVENUECAT_IOS_KEY` (RevenueCat `appl_…`; `docs/TESTFLIGHT.md`). Elle başlatma: Actions → iOS (TestFlight) ya da commit mesajında `[ios]`.
- Ödeme: `react-native-purchases` 10.16.x, mağazayla konuşan tek dosya `src/lib/purchases.ts` (RevenueCat `appUserID` = Supabase kullanıcı kimliği, girişte `configure`/`logIn`, çıkışta `logOut`; entitlement `premium`, offering `default`). Anahtar yoksa ödeme "bağlı değil". Web önizlemede `preview/demo-purchases.ts` yerine geçer.
- iPad (3 Kasım 2026): `supportsTablet: true`; iPhone yalnız dikey, iPad dört yön (Expo eklentisi `UISupportedInterfaceOrientations~ipad`'i doldurur). Ekranlar geniş ekranda ortada en çok 720 noktalık sütunda (`src/components/Column.tsx`, gezinmede `screenLayout`); ana sayfa yatayda iki sütun. Pencere/alt sayfa kartları `maxWidth` ile sınırlı. Pencere genişliği yerine sütun genişliği kullan (ör. Görevler'deki hafta şeridi).
- **Denetim (kullanıcı isteği 5 Kasım 2026: "bir daha bozulmasın"):** `.github/workflows/denetim.yml` her push'ta, her gün ve elle: tür denetimi, web derlemesi, uygulama ↔ tarif (`tools/contract/check-db.mjs`, ortak göçleri boş PostgreSQL'de) ve uygulama ↔ canlı Supabase (`tools/contract/check.mjs`: çağrılan her RPC argüman adlarıyla, tablo + sütun, Edge Function, giriş ayarları; yalnız okur). Yeni RPC/tablo kullanan değişiklik, SQL canlıya uygulanmadan "canlı" adımında kırmızı olur; bu beklenen uyarıdır. Ortakta `.github/workflows/test.yml` her push'ta SQL testlerini çalıştırır.
- **iOS pencere kuralı:** bir RN `Modal` (Sheet, Dialog, Info, …) açıkken modal EKRAN (Üyelik, Davet, …) açılamaz, istek sessizce yok sayılır ("hiçbir şey olmadı"; iPad'de Aile › Çocuk ekle, 5 Kasım 2026). Yeni pencere bileşeninde `useModalOpen(visible)`; pencerenin içinden ekran açarken önce pencereyi kapat, sonra `afterModal` / `whenNoModal` (`src/lib/modal.ts`). Üyelik ekranı (`requestPremium`) bunu kendisi yapar. Web önizleme bu hatayı göstermez; iPhone/iPad'de dene.
- **Ebeveyn eğitimi ve davranış olayı (9 Kasım 2026; ortak `akislar.md` 23–24):** içerik ortaktan kopya (`node tools/sync-training-library.mjs ../ortak/veri/ebeveyn_egitimi_kutuphane.json` → `src/data/trainingLibrary.json`, elle düzenlenmez); veri `src/lib/trainings.ts`, `src/lib/incidents.ts`. 5 Kasım ders düzeni (`lessons.ts`) ve Davranış kaydı (`abc.ts`) ile kullanıcı kararı gelene dek birleştirilmez.
- **Takip Planı bayrak arkasında (kullanıcı kararı 11 Kasım 2026, lansman odağı ebeveyn eğitimi; ortak `akislar.md` 12.2):** uzaktan ayar bayrağı `care_plan` (yoksa **kapalı**; ClinicApp ile aynı bayrak, yönetim panelinden açılır). Kapalıyken `useCare` planı hiç okumaz (`src/lib/care.ts` `CARE_PLAN_FLAG`): Ben › Programına devam et ve "Bugün n uygulama", Uzmanım › Program ve program satırları, önerilerdeki davranış hedefi etiketi, Davranış kaydındaki davranış hedefi seçimi görünmez; `CarePlanScreen` kısa not gösterir. Macera / rutin önerileri, ebeveyn eğitimi, olay bildirme, randevular etkilenmez. Veri ve işlevler durur; yeni plan parçası eklerken bu bayrağa bağla.
- **Sessiz başarısızlık yok:** sunucu işlemi yapılamıyorsa kullanıcıya kısa uyarı (ör. aile bilgisi yüklenmediyse `noFamily`), `return` ile sessizce çıkılmaz.
- İlk TestFlight yüklemesi: 19 Ekim 2026.
- Durum ve geçmiş: `docs/DURUM.md`.

## Ürün kararları

- İş modeli (19 Ekim 2026): aile aboneliği (ParentApp) + klinik kanalı (ClinicApp). Raporlar iki okuyucuya yazılır: ebeveyn ve uzman. Klinik paylaşım yalnız ebeveyn rızasıyla, geri alınabilir.
- Tasarım dili sade ve işlevsel (lacivert `#0F1B3D`); ClinicApp bunu izler.
- **Benchmark alışkanlığı** (kullanıcı kararı 2 Kasım 2026; ortak CLAUDE.md kural 7): her yeni özellik, çıkarma ya da iyileştirmede (akış, tasarım, metin, arayüz, iş kuralı) önce aynı işi yapan başarılı global uygulamaları araştır; en iyi örnekleri artı/eksileriyle değerlendir, ürünün amacına uyanları kullanıcıya seçenek ve öneri olarak sun, kaynakları yaz. İçerik, karakter ve metin kopyalanmaz; yalnız işleyiş referans alınır.
- **Canlıya alma elle yayın** (kullanıcı kararı 2 Kasım 2026; ortak `CANLIYA_ALMA.md` 2.1): App Store Connect'te "Manually release this version"; Apple onaylayınca sürüm kullanıcının onayıyla yayına alınır. CI yalnız TestFlight'a yükler, mağazaya göndermez.
- Referanslar: Joon iş modeli kanvası https://claude.ai/code/artifact/df7eafa7-1e1e-4014-8a5f-7d88cb985485 · Oyun omurgası analizi https://claude.ai/code/artifact/3c82704c-e120-4d73-ba9f-a7ffdc75eeac
