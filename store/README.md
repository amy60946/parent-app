# ParentApp App Store ekran görüntüleri

Kullanıcı isteği (4 Kasım 2026): App Store ekran görüntüleri; benchmark ile marka güveni ve kurumsal izlenim, güçlü tasarım, kolay anlaşılır anlatım; 3 alternatif.

| Yol | Ne |
|---|---|
| `capture/` | Gerçek ParentApp ekranları: web önizlemesi (`preview/out/app.html`) 440×868 nokta @3x. `prep.js` deneme verisini mağazaya uygun hâle getirir: koşullar onaylı, deneme bandı ve uzman davetleri kapalı, son 6 haftanın tamamlanan görevleri, kurgusal uzman ve kurum adları ("Elif Örnek", "Örnek Danışmanlık Merkezi"). Uygulama kodu değişmez. |
| `render.js` | Üç tasarım (A, B, C), her biri 7 kare, 1320×2868. Metinler dosyanın başındaki `SLIDES` listesinde. |
| `slice.py` | Saydamlığı kaldırır (Apple: alpha kanalı olmaz), 6.3" 1206×2622 kopyası ve önizleme JPEG'i üretir. |
| `build.sh` | Hepsi: `bash preview/build.sh && bash store/build.sh`. Çıktı `store/out/` (depoya girmez). |

Yazı tipleri: başlık Inter Display, metin Inter (yerelde kurulu), C'nin başlığı Source Serif 4 (`build.sh` npm'den indirir). Uygulama ekranlarında iPhone'un sistem yazısına en yakın Inter kullanılır.

## Apple kuralları (developer.apple.com, 4 Kasım 2026)

- Boyut: iPhone için en az bir **6.3"** set (1206×2622) zorunlu; 6.9" (1320×2868) verilirse büyük ekranlarda o görünür. iPad'i desteklediğimiz için **13" iPad** (2064×2752) seti de zorunlu. En çok 10 kare, PNG/JPEG, saydamlık yok.
- Aramada dikey görselin **ilk 3'ü** görünür. Ziyaretçilerin çoğu galeriyi kaydırmaz: hikâye ilk 3 karede biter.
- 2.3.3: karelerin yarısından fazlası uygulamanın kullanımını gösterir (bizde 7'nin 7'si gerçek ekran; oyun görseli yalnız 3. karede yardımcı).
- 2.3.7: görselde fiyat, indirim, "7 gün ücretsiz", web adresi yok. 2.3.2: abonelik gerektiren özellik belirtilir (son karede dipnot).
- 2.3.8 / 5.1.4: "çocuklar için" ifadesi Kids kategorisine ayrılmıştır; görseller ana kitlenin çocuk olduğu izlenimini vermez. 2.3.9: kurgusal hesap bilgisi. 2.3.10: başka platform adı ya da görüntüsü yok.
- Apple cihaz çerçevesi ancak Apple'ın verdiği hâliyle (eğme, gölge, taşan öğe olmadan) kullanılabilir. Bu yüzden telefon çizimi yok; yalnız ekranın kendisi (durum çubuğu 9:41, sinyal, Wi-Fi, pil tam).
- Türkiye mağazasının varsayılan dili İngilizce (U.K.): Türkçe yerelleştirme ayrıca eklenip görseller oraya yüklenir.
- Yayından sonra: Ürün Sayfası Optimizasyonu ile en çok 3 alternatif A/B denenir (yalnız ilk 3 karenin mesajı değişir); kampanyalar Özel Ürün Sayfalarına bağlanır.

## Benchmark (24 uygulamanın App Store görselleri, 4 Kasım 2026, alt ajanlarla incelendi)

Aynı iş: Joon, Greenlight, BusyKid, S'moresUp, Homey, Goally, Chorsee, GoHenry. Güven ağırlıklı aile ve ebeveyn uygulamaları: Brightwheel, ClassDojo, Life360, Google Family Link, Qustodio, Bark, Huckleberry, Understood. Tasarımda öne çıkanlar: Tiimo, Structured, Headspace, Calm, Finch, Lingokids, Khan Academy Kids, Acorns Early.

Alınanlar:
1. Tek marka zemini ve sabit şablon: her karede aynı yerde 2 satır başlık + kısa alt satır (Greenlight, GoHenry, Acorns Early, Structured).
2. İlk 3 karede döngünün tamamı, fiille: planla → çocuk oyunda yapar → onayla (Homey, Joon, Chorsee).
3. Arayüzden büyütülmüş tek parça (Tiimo, Family Link, Life360): küçük görselde de okunur.
4. Çocuk fotoğrafı yerine oyun görseli ve karakter (ClassDojo + Dojo Islands, Understood).
5. Rozet ve sayı yerine olguya dayalı güven: "Reklam yok · Veri satışı yok", rıza cümlesi, dürüst dipnot (Khan Academy Kids, Huckleberry).
6. Tam Türkçe: Life360, Family Link, Qustodio, Headspace, Calm, Joon Türkiye mağazasında İngilizce. Doğal Türkçe set bizi ayırır.

Alınmayanlar: "#1", "N milyon aile", ödül ve basın logoları, yıldız ve yorum (elimizde yok, uydurulmaz); sağlık ve DEHB konumlandırması (Joon, Understood); korku ve gözetim dili (Bark, Qustodio, Life360); çocuk fotoğrafı; para ve "kazan"; "for kids".

## Üç alternatif

| | Yön | Örnek aldığı | Güçlü yanı | Zayıf yanı |
|---|---|---|---|---|
| **A** Sakin ve kurumsal | Açık zemin, lacivert başlık, tam ekran | Structured, Acorns Early, GoHenry | En kurumsal ve okunur; web sitesiyle aynı dil | Sıradan durabilir |
| **B** Lacivert + büyütülmüş ayrıntı | Lacivert zemin, sarı vurgu sözcüğü, ekran + büyütülmüş parça | Chorsee, Understood, Life360, Tiimo | Aramada en çok dikkat çeken, küçükte okunur | Koyu zemin web sitesinin açık zemininden ayrılır |
| **C** Bağlı hikâye | Tek parça zemin, adım etiketleri, sarı yol, oyun görseli iki kareye taşar | ClassDojo, Joon 3–4, Structured 1–2 | Akışı en iyi anlatan | Tek kare kendi başına daha az anlatır |

Metinler (üçünde aynı, "siz" dili; web sitesiyle uyumlu):

1. Çocuğunuzun günlük rutini tek ekranda · Görev verin, yapılanları görün, onaylayın.
2. Rutini birkaç dakikada oluşturun · Yaşına uygun hazır rutinlerden seçin ya da kendi görevinizi yazın.
3. Görevler Pofi Adası'nda görünür · Çocuğunuz görevini oyunda görür, yapınca işaretler. (Not: Pofi Adası, çocuğunuzun cihazına kurulan ayrı bir uygulamadır.)
4. Yapılan görevi onaylayın · Onayladığınızda çocuğunuz oyunda Güneş Taşı alır.
5. Ödülleri birlikte seçin · Çocuğunuz biriktirdiği Güneş Taşı'yla ödül ister, siz onaylarsınız.
6. Gelişimi gün gün görün · Hangi alışkanlığın yerleştiğini haftalık özetle görün.
7. Dilerseniz uzmanınızla paylaşın · Paylaşım yalnız sizin onayınızla açılır, istediğiniz an kapanır. (Reklam yok · Veri satışı yok · Hesabınızı istediğiniz an silebilirsiniz; dipnot: Bazı özellikler Premium üyelik gerektirir. Örnekteki adlar kurgusaldır.)

## Seçimden sonra

- Seçilen tasarımın iPad 13" seti (gerçek iPad düzeni: ortada sütun, yatayda iki sütun).
- 3. karedeki oyun görseli şimdilik oyunun yükleme görseli (`site/public/img/iskele.jpg`). Görev panelli gerçek oyun ekranı GameApp penceresinden gelince değiştirilir.
- Yüklemeden önce `hukuk/45` §7.1 kontrolü; Türkçe yerelleştirmeye yükleme; App Review notu (deneme kayıtla başlar, ortak DURUM 2 Kasım).
