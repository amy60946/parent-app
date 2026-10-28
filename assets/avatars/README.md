# Avatar görselleri

| Avatar | Dosya adı |
|---|---|
| Çocuk – Okti kız (Kurdeleli, Çiçek tokalı, Taçlı, Kalp gözlüklü, Bereli, Kulaklıklı) | `okti_kiz_1.jpg` … `okti_kiz_6.jpg` (eklendi) |
| Çocuk – Okti erkek (Kasketli, Pervaneli, Pilot, Güneş gözlüklü, Antenli, Köpek balığı şapkalı) | `okti_erkek_1.jpg` … `okti_erkek_6.jpg` (eklendi) |
| Ebeveyn – Okti anne (Çiçekli, Hasır şapkalı, Fiyonklu gözlüklü) | `okti_anne_1.jpg` … `okti_anne_3.jpg` (eklendi) |
| Ebeveyn – Okti baba (Bıyıklı gözlüklü, Kaptan, Kasketli) | `okti_baba_1.jpg` … `okti_baba_3.jpg` (eklendi) |

Okti görselleri game-app `art/parent_avatars/drafts/` taslaklarından 384×384 küçültüldü; eski `kadın` / `erkek` kimlikleri `okti_anne_1` / `okti_baba_1` gösterir; eski hayvan kimlikleri (`martı` …) çocuğun cinsiyetine göre bir Okti çocuğu gösterir (`src/data/avatars.ts` childAvatarId).

- PNG, şeffaf arka plan, kare (512×512 önerilir). İstersen `@2x`/`@3x` sürümlerini de ekleyebilirsin (`kedi@2x.png`).
- Dosyayı ekledikten sonra `index.ts` içindeki ilgili satırın başındaki `//` işaretini kaldır.
- Dosya adları Türkçe karakter içermez; uygulamadaki avatar kimlikleri (`martı`, `köpek`…) değişmez, veritabanındaki kayıtlar etkilenmez.
