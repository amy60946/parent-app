# Moyo marka kiti

Kullanıcı isteği (11 Kasım 2026): küçük harf "moyo" sözcük logosu ("y" harfinde hareket), uzman ürününde yanında ince, düz
"mercek"; renk ve yazı tipi için verilen referans temel alınır; üç uygulama iconu (Moyo, Moyo Mercek, Moyo Oyun) tek aile.
Kitin tek sahibi bu depodur (Ebeveyn penceresi); Moyo Mercek ve Oyun pencereleri seçimden sonra buradan alır.

**Durum: seçim bekliyor.** Önizleme: yayınlanınca buraya eklenir.

| Yol | Ne |
|---|---|
| `build.py` | Hepsini üretir. `python3 brand/build.py` → `svg/`, `tokens.css`, `tokens.json`. `python3 brand/build.py <klasör>` → ayrıca önizleme sayfası. |
| `kit.py`, `geom.py` | Çizim: sözcük logo, "y" kuyruğu, kilitler, iconlar, renk listesi. |
| `svg/logo/` | `moyo-<a\|b\|c>-<renk>.svg`, `moyo-mercek-…`, `moyo-oyun-…`. Renk: `lacivert` (açık zemin), `yesil` (koyu zemin), `beyaz`. |
| `svg/icon/` | `<moyo\|mercek\|oyun>-<aile><logo>.svg` (ör. `moyo-3a.svg`). 1024 × 1024, köşesiz, saydam alan yok. |
| `tokens.css`, `tokens.json` | Renk ve yazı değişkenleri (`--moyo-…`). Üretilir, elle düzenlenmez. |
| `fonts/` | Outfit (sayfa ve uygulama yazısı) ve Poppins 300 / 800 (yalnız logo çizimi için). İkisi de SIL OFL 1.1 (`OFL-*.txt`). |
| `onizleme.html` | Önizleme sayfasının kalıbı. |

Gerekenler: `pip install fonttools brotli uharfbuzz`.

## Seçenekler

- **Sözcük logo:** A Kıvrım (kuyruk içe kıvrılır) · B Gülüş (kuyruk sola uzanıp yükselir) · C Top (kısa kanca + ayrı duran top).
  m ve o harfleri Poppins ExtraBold'un dış çizgisi; "y" özgün çizim ("u" gövdesi + `kit.tail()`). Dosyalarda yazı tipi yok, yalnız yol.
- **Icon ailesi:** 1 Sözcük · 2 y işareti · 3 İki satır ("mo" / "yo"). Ürün rengi: Moyo lacivert zemin, yeşil harf; Moyo Mercek
  beyaz zemin, lacivert harf, yeşil mercek sapı; Moyo Oyun yeşil zemin, lacivert harf.
- **Yazı tipi:** referans sitenin yazısı Galano Grotesque (René Bieder, ücretli: aile 250–300 USD liste fiyatı, web ve uygulama
  lisansı ayrıca ve yıllık). Ona en yakın açık lisanslı yazı Outfit; on aday aynı metinle yan yana karşılaştırıldı (tek katlı "a",
  düz kuyruklu "y", yuvarlak gövdeler). Önizleme ve yeni tanıtım sayfası Outfit ile yazıldı. Outfit'te ₺ işareti yok: fiyat "TL" yazılır.

## Kurallar

- Yeşil açık zeminde yazı rengi olmaz (kontrast 1,6 : 1); düğme ve dolgu rengidir, üstüne lacivert yazılır.
- Logo çizimi özgündür; referans markanın harfi, görseli, metni kopyalanmaz (ortak `CLAUDE.md` kural 7). Renk + yazı tipi + kıvrım
  birlikte referansa yakın durur: marka tescilinde avukata sorulur.
- Seçimden sonra: seçilmeyen alternatifler `svg/`'den silinir, `tokens.json` `secilen` alanları doldurulur, uygulama iconu
  (`assets/icon.png`, Android katmanları, `tools/brand/splash.py`) seçilen icondan üretilir. Uygulama içi renkler ayrı iş.
