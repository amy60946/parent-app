# Tanıtım sayfası: yeni düzen (seçim bekliyor)

Kullanıcı isteği (11 Kasım 2026): ürün, gerçek arayüzün yavaş ve akıcı hareketli anlatımıyla sunulsun; yerleşim ferah, ana menü
sade olsun; **fiyat ana sayfada değil, ayrı sayfada** dursun. Marka `brand/` kitinden gelir.

Önizleme: https://claude.ai/artifact/C6dGXNz63c5koGCrSBDFXb (ana sayfa; menüde "Fiyat" ayrı sayfayı açar).

| Dosya | Ne |
|---|---|
| `build.py` | `python3 site/yeni/build.py <klasör> [--logo a\|b\|c] [--onizleme]` → `index.html`, `fiyat.html`, `img/`, `fonts/`. |
| `sayfa.css` | İki sayfanın ortak stili (renk ve yazı `brand/tokens.css` değerleriyle). |
| `demo.js` | Üstteki gösterim, fiyat sayfasındaki aylık / yıllık geçişi, açılır menü. |
| `ekranlar.json`, `ekranlar.py`, `img/` | Gerçek Moyo ekranları (kullanıcı isteği 13 Kasım 2026). Web önizlemesinden çekilir (deneme verisi, adlar kurgusal): `bash preview/build.sh`, `STORE_REAL=<klasör> node store/capture/capture.js site/yeni/ekranlar.json`, `python3 site/yeni/ekranlar.py <klasör>`. `img/ekranlar.json` dokunma noktasını yüzde olarak tutar. |

- **Metin tek kaynaktan:** başlık ve paragraflar `site/landing.html`'den okunur, çıktıda kelimesi kelimesine bulunduğu denetlenir.
  Yeni yazılan tek metin fiyat sayfasındaki plan satırları ve beş sorudur (kaynak: `src/data/plans.ts`). Fiyat rakamları yer tutucu
  (`— TL`); ana sayfada "TL" geçerse üretim durur.
- **Üst bölüm (kullanıcı, 13 Kasım 2026):** ana başlık ürünün ne olduğunu söyleyen cümle (eski yeşil satır), altında eski ana başlık
  alt başlık olarak, altında giriş paragrafı ("6–12 yaş" ile başlayan ilk cümle çıkarıldı) daha küçük; hepsi sola hizalı. Sağda oyun
  ekranı ile Moyo'nun **gerçek** onay ekranı yan yana. Gösterim: çocuk tablette "Yaptım"a dokunur → telefona bildirim → ebeveyn
  "Onayla"ya dokunur → oyunda "Onaylandı". Bir seferde tek değişiklik, döngü ~11 sn; görünmüyorken durur, "Durdur" düğmesi var,
  "hareketi azalt"ta ve JS yokken durağan. Oyun ekranındaki görev kartı makettir.
- **Faydalar:** her satırda gerçek Moyo ekranı (Gelişim, Maceralar, Ödüller, Macera oluştur).
- **Ölçüler (benchmark, 12 Kasım 2026):** bölüm boşluğu 120 px, içerik 1120 px, başlık 58 / 48, giriş 24, gövde 18 px; menüde beş
  madde + iki düğme; fiyat sayfasında dönem geçişi, üç kart (ortadaki vurgulu), karşılaştırma tablosu, sorular.
- **Bekleyen "1 Kaydır / 2 Tek ekran / 3 Dokun" kararı** (`site/alternatifler/`): bu düzen 3'e en yakın olandır, ama dokunmayı
  beklemez; gösterim kendiliğinden oynar. Kullanıcı bu düzeni seçerse üç alternatif kapanır.
- Yayındaki siteyi (`landing.html`, `build-cf.sh`) etkilemez. Seçilince: `build.py` çıktısı `landing.html` + `fiyat.html` olarak
  `build.sh` / `build-cf.sh`'e bağlanır (`/fiyat` yolu, giriş / kayıt bağlantıları), `hukuk/45` §1.1 ve §7.1 kontrolü yapılır.
