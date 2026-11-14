# ParentApp web sitesi (ParentApp + Pofi Adası)

Kullanıcı isteği 4 Kasım 2026: ParentApp ve Pofi Adası için tek tanıtım sayfası + ParentApp'e web'den giriş ve kayıt.
`landing/` (22 Ekim 2026, yalnız ParentApp, girişsiz) bunun yerine geçti.

| Yol | Ne |
|---|---|
| `landing.html` | Tanıtım sayfası. İskeletsiz yazılır (`<title>`, `<style>` ve gövde); önizlemede Artifact iskeleti ekler, `build.sh` tam belgeye sarar. |
| `public/fonts/` | Yazı tipi **Plus Jakarta Sans** (Moyo Mercek tanıtım sitesiyle aynı, kullanıcı isteği 10 Kasım 2026; clinic-app `site/assets/fonts`'tan kopya), SIL OFL 1.1 (`OFL.txt`). Kendi dosyasından yüklenir, Google Fonts'a istek gitmez. |
| `public/img/` | Görseller. Oyun görselleri GameApp penceresinin onayladığı dosyalardan küçültüldü (game-app `claude/affectionate-hawking-ozf41w`: `Resources/Art/pick_stage.jpg` → `kumsal.jpg`, `load_residents.jpg` → `adalilar.jpg`, `film_1_ada.jpg` → `ada.jpg`, `load_beach.jpg` → `iskele.jpg`, `Art/AppIcon.png` → `pofi-simge.png`, `Icons/ui_sunstone.png`, `Icons/ui_coin.png`); Okti avatarları `assets/avatars/`. `tools/preview/keyart.jpg` kullanılmaz (kullanıcı kontrol etmedi). |
| `yeni/` | **Yeni düzen, seçim bekliyor (12 Kasım 2026):** hareketli ürün gösterimi, ferah yerleşim, fiyat ayrı sayfada (`fiyat.html`); marka `brand/` kitinden. Ayrıntı `yeni/README.md`. Yayındaki siteyi etkilemez. |
| `alternatifler/` | Etkileşim alternatifleri 1 Kaydır / 2 Tek ekran / 3 Dokun (10 Kasım 2026); `yeni/` seçilirse kapanır. |
| `build.sh` | `dist-site/` üretir: kök = tanıtım sayfası, `/app/` = ParentApp'in web derlemesi (giriş, kayıt, kurulum, cihaz bağlama). `--demo` deneme veritabanıyla. |

## Cloudflare yayını (6 Kasım 2026; ortak DURUM 6 Kasım, CANLIYA_ALMA 1.2)

Kullanıcı kararı: `moyoapp.com.tr` kök = tanıtım sitesi, `ebeveyn.moyoapp.com.tr` = ParentApp web (taban yol `/`). İki ayrı Worker, yalnız statik dosya; `workers_dev` ve `preview_urls` kapalı (açık kalırsa `*.workers.dev` önizleme kilidi olmadan herkese açılır), route'lar yapılandırmada yok (yönetim paneli penceresi ilk yayından sonra API ile bağlar; kökte `/destek` ve `/yasal/*` panelin Worker'ında).

| Worker | Yapılandırma | Derleme | Yollar | Değişken |
|---|---|---|---|---|
| `moyo-site` | `wrangler.site.jsonc` | `bash site/build-cf.sh site` → `dist-site/` | `/`, `/img/*`, `/d/*` (davet sayfası `site/d/index.html` → `/davet/`, `_redirects` `/d/* /davet/ 200`; kaynağı ortak `web/davet/`), `/.well-known/apple-app-site-association` (uzantısız, `application/json`, `/d/*`) | `APPLE_TEAM_ID` |
| `moyo-ebeveyn` | `wrangler.ebeveyn.jsonc` | `npm ci && bash site/build-cf.sh ebeveyn` → `dist-ebeveyn/` (tek sayfa uygulama) | hepsi | `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_KEY` (yalnız publishable) |

**Çatı sayfa ve Moyo Ebeveyn sayfası (14 Kasım 2026, kullanıcı isteği "şifre girişli sistemi aktif tutarak live'a al"):** `site/moyo/` hazır çıktıdır, elle düzenlenmez: kaynağı clinic-app `tools/cati-sayfa` (`python3 disa_aktar.py <parent-app>/site/moyo`). `build-cf.sh site` bunu `dist-site/`'ın üstüne kopyalar: `/` = çatı sayfa (eski `landing.html`'in yerine), `/ebeveyn/` = Moyo Ebeveyn sayfası, `/c/…` = stil, betik, yazı tipi ve görseller. Kilit (Cloudflare Access) alan adındadır; bu derleme ona dokunmaz.

Yayın komutu: `npx wrangler@4 deploy -c wrangler.site.jsonc` / `-c wrangler.ebeveyn.jsonc`. Tanıtım sayfasının kaynağı değişmez (önizleme için `app/index.html#…`); `build-cf.sh` giriş/kayıt düğmelerini `https://ebeveyn.moyoapp.com.tr/#kayit` `#giris`'e, alt bilgiyi `/destek` ve `/yasal/…`'a çevirir. Uygulama: `app.json` `ios.associatedDomains` = `applinks:moyoapp.com.tr` (App ID yeteneği `tools/ci/asc_sign.py` açar). Supabase dönüş adresleri: `https://ebeveyn.moyoapp.com.tr/**` ve `parentapp://**`.

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

## Metin ilkeleri (kullanıcı 4 Kasım 2026 + Marketing penceresi)

Slogan yok; nazik, profesyonel, çok açık ve kısa dil; karar verici ebeveyn, çocuğa hitap yok; ParentApp önde, oyun ikinci planda; "aile uygulaması" kullanılmaz; Joon kalıpları işleyiş referansı, birebir çeviri değil. Marketing'in kaçınılacak kelimeleri: tedavi, iyileştirir, düzeltir, çözer, tanı adları, kanıtlanmış, bilimsel, belgesiz "uzmanlar öneriyor", garanti, en iyi / ilk, disiplin, itaat, takip / izleme / kontrol, para / kazan / harçlık, gerçek değilse "ücretsiz", rakip adı, "yaramaz / uslu / sorunlu çocuk". Düğme "7 gün ücretsiz deneyin" (ParentApp'te gerçek olan deneme; "ücretsiz" yalnız Pofi Adası için), yanında yenileme satırı. Yayından önce `hukuk/45` §7.1 kontrolü.

Kullanıcı kararı (4 Kasım 2026, akşam): Marketing önerili sürüm yerine **Joon kalıplarının Türkçesiyle yazılan sürüm** kullanılır (başlık "Çocuğunuzun günlük görevlerini düzenli yapmasına yardımcı olan uygulama", kartlar "Rutini birkaç dakikada oluşturun · Sürekli hatırlatmak zorunda kalmayın · Görev yapmayı keyifli hâle getirin · Sorumluluk almayı öğretin", düğme "Ücretsiz kaydolun"). Yukarıdaki kelime listesi bilgi olarak kalır.

## Sürümler (4 Kasım 2026)

- **A** `landing.html` (https://claude.ai/artifact/2tHXF5iD7HUpTGeCNHtPAW): Joon kalıplı metin, yalnız açık zemin (kullanıcı isteği; koyu tema yok).
  **9 Kasım 2026:** üst bölüm, "MOYO’NUN FAYDALARI" (4 kart) ve "MOYO NASIL ÇALIŞIR?" (3 adım + kapanış cümlesi) kullanıcının verdiği metinle, kelimesi kelimesine. **Yayından (önizleme kilidi kalkmadan) önce** ortak `hukuk/45` §1.1–1.4 ve Marketing §7.1 kontrolü: hastalık adıyla hedefleme (DEHB, otizm), sonuç iddiaları ("dikkatini artırın", "birkaç hafta içinde", "%90’ı", "bilimsel araştırmalara dayanan"), metnin rakip sitesinin metnine yakınlığı. Kullanıcı kararları (9 Kasım 2026): oyun içi karakter **Okti** ("Doter" yerine), uygulamanın adı sayfada **Moyo** (eski "ParentApp" yazıları da).
- **B** `landing-b.html` (https://claude.ai/artifact/PQzj8snEtfDvdHB1bC36Px): aynı metin; üstte oyun yatay telefon çerçevesinde, ParentApp dikey telefonda, ziyaretçi dokunarak dener (Yaptım → bildirim → ✓ onay → +1 Güneş Taşı). Oyundaki görev paneli maket ("Örnek gösterim"); gerçek oyun ekran görüntüsü gelince yerine konur. Hangisi seçilirse `build.sh` onu `index.html` yapar (şimdilik A).
