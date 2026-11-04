# ParentApp web sitesi (ParentApp + Pofi Adası)

Kullanıcı isteği 4 Kasım 2026: ParentApp ve Pofi Adası için tek tanıtım sayfası + ParentApp'e web'den giriş ve kayıt.
`landing/` (22 Ekim 2026, yalnız ParentApp, girişsiz) bunun yerine geçti.

| Yol | Ne |
|---|---|
| `landing.html` | Tanıtım sayfası. İskeletsiz yazılır (`<title>`, `<style>` ve gövde); önizlemede Artifact iskeleti ekler, `build.sh` tam belgeye sarar. |
| `public/img/` | Görseller. Oyun görselleri GameApp penceresinin onayladığı dosyalardan küçültüldü (game-app `claude/affectionate-hawking-ozf41w`: `Resources/Art/pick_stage.jpg` → `kumsal.jpg`, `load_residents.jpg` → `adalilar.jpg`, `film_1_ada.jpg` → `ada.jpg`, `load_beach.jpg` → `iskele.jpg`, `Art/AppIcon.png` → `pofi-simge.png`, `Icons/ui_sunstone.png`, `Icons/ui_coin.png`); Okti avatarları `assets/avatars/`. `tools/preview/keyart.jpg` kullanılmaz (kullanıcı kontrol etmedi). |
| `build.sh` | `dist-site/` üretir: kök = tanıtım sayfası, `/app/` = ParentApp'in web derlemesi (giriş, kayıt, kurulum, cihaz bağlama). `--demo` deneme veritabanıyla. |

## Web uygulaması (`/app/`)

- ParentApp'in kendisi (react-native-web), ClinicApp'teki `site/` + `/app/` düzeniyle aynı. Tanıtım sayfasındaki düğmeler `app/index.html#kayit` ve `#giris` ile doğrudan kayıt ya da giriş ekranını açar (`AuthScreens` WelcomeScreen).
- Web'de satın alma yok (`src/lib/purchases.web.ts`): üyelik iPhone/iPad'deki ParentApp'ten başlatılır, aynı hesapla web'de de açılır.
- E-posta bağlantıları web'de aynı sayfaya döner (`authRedirectUrl`); bağlantıdaki anahtarlar adres çubuğundan silinir.
- Bildirim (push) web'de yok; geri kalan akışlar aynı.

## Yayından önce (karar ve işlem bekleyenler)

1. Alan adı ve barındırma (Cloudflare önerildi, `hukuk/41-alt-isleyenler.md` 6). `dist-site/` statik olarak yüklenir; `_redirects` ve `_headers` Cloudflare Pages biçimindedir.
2. Supabase › Authentication › URL Configuration: Site URL = `https://<alan adı>/app/`, Redirect URLs'e `https://<alan adı>/app/**`.
3. Derleme: `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_KEY` (yalnız publishable; CI'da `SUPABASE_PUBLISHABLE_KEY` secret'ı) ile `bash site/build.sh`.
4. Alt bilgideki `yasal/…` ve `destek` bağlantıları alan adındaki yasal metin ve destek sayfalarına gider (yönetim paneli `/yasal`, `/destek`); şirket unvanı, adres ve iletişim adresleri avukat onayından sonra eklenir.
5. Yayın zamanı uygulamaların App Store yayınıyla aynı olmalı: web'den açılan hesapta 7 günlük deneme kayıt anında başlar.
6. Fiyatlar (şimdilik "App Store yayınında yazacak"), App Store bağlantıları ("Yakında App Store'da" yerine), App Store ekran görüntüleri (GameApp penceresi, oyun yatay).
7. Sayfa çerez ve izleme kullanmaz. Analiz eklenecekse önce çerez bandı ve politika (`hukuk/45` §3, `hukuk/40`).

## Benchmark notu (Joon, 4 Kasım 2026; sayfa doğrudan incelendi)

Sıra: iddialı ebeveyn manşeti + yaş + "ücretsiz kayıt" → basın logoları → 4 fayda kartı (dert → çözüm) → 3 adım → araştırma → aile sayısı ve yorumlar → SSS → sonuç çağrısı. Bizde alınanlar: dert → çözüm ana mesajı, "Tanıdık mı?" kartları, hedef yaş, "Ücretsiz hesap oluştur", menüde "Uzmanlar". Alınmayanlar (hukuk/45): sağlık konumlandırması (DEHB vb.), belgesiz yüzdeler ve sonuç iddiaları, "hatırlatmayı biz yaparız" (çocuğa bildirim henüz yok). Yayından sonra eklenecek güven öğeleri: gerçek ve yazılı izinli ebeveyn yorumları (hukuk/45 5.2), mağaza puanı, varsa basın.
