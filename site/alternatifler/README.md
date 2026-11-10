# Tanıtım sayfası: etkileşim alternatifleri

Kullanıcı isteği (10 Kasım 2026): "landing page için animasyonlu / interaktif / tek ekranda kaydırdıkça güncellenen yazı ve ekran
görselleriyle alternatifler; içerikler aynı kalsın, UI/UX değişsin; karışık, zorlayıcı olmasın, işlevsel olsun; önizleme olarak paylaş."

| Alternatif | Dosya | Ne yapar |
|---|---|---|
| 1 · Kaydır | `kaydir.css` / `kaydir.js` | Telefon sabit durur (`position: sticky`), yazı akar; ekranın ortasındaki yazıya göre telefondaki ekran değişir. Dar ekranda her başlığın altında kendi ekranı. |
| 2 · Tek ekran | `tek-ekran.css` / `tek-ekran.js` | Bölüm ekrana sabitlenir; kaydırma ilerledikçe yazı ve ekran yerinde değişir. Noktalarla adım seçilir, "Bölümü geç". Kaydırma ele geçirilmez (tarayıcının kendi kaydırması). JS yoksa yazılar alt alta. |
| 3 · Dokun | `dokun.css` / `dokun.js` | Kaydırmaya bağlı değil. Faydalar 7 sn'de bir ilerleyen sekmeler (üzerine gelince durur, dokununca kapanır, dar ekranda ve "hareketi azalt"ta kapalı); "Nasıl çalışır" üç dokunuşluk deneme (ekle → Yaptım → onayla). |

- **Metin tek kaynaktan:** `build.py` başlık ve paragrafları `site/landing.html`'den okur ve her çıktıda kelimesi kelimesine bulunduğunu
  denetler. Yalnız "Faydalar" ve "Nasıl çalışır" bölümleri değişir; sayfanın geri kalanı aynıdır.
- **Örnek ekranlar** `ekranlar.py` (telefon içi sade kopyalar; kategori adları uygulamadaki gibi; adlar örnek).
- **Önizleme kabuğu** `kabuk.html`: seçici, telefon / bilgisayar genişliği, karşılaştırma ve benchmark (`benchmark.json`).
- Üretim: `python3 site/alternatifler/build.py <çıktı klasörü>` → `kaydir.html`, `tek-ekran.html`, `dokun.html`, `simdiki.html`, `index.html`, `img/`, `fonts/`.
  Çıktı depoya girmez (`out/`). Yayındaki siteyi (`build-cf.sh`) etkilemez.
- Önizleme: https://claude.ai/artifact/ (bağlantı `docs/DURUM.md` 10 Kasım satırında).

Benchmark sınırı (10 Kasım 2026): oturumun ağı aday sitelerin çoğunu açamadı; yalnız Joon'un sayfası ve App Store sayfaları doğrulandı
(`benchmark.json` `bakildi`). Öteki satırlar arama sonuçlarına ve bilinen düzene dayanır.

Seçilen alternatif `landing.html`'e taşınırken: ilgili `.css` / `.js` sayfaya gömülür, `ekranlar.py`'deki ekranlar düz HTML olarak yazılır,
`hukuk/45` §1.1 (yalnız var olan özellik gösterilir) için örnek ekranlar ürünle karşılaştırılır.
