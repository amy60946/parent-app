# Supabase panel ayarları (adım adım)

Bu adımlar bir kez yapılır. Menü adları Supabase panelinin güncel sürümüne göre küçük farklılık gösterebilir.

## 1. Veritabanı

1. **SQL Editor > New query**
2. `supabase/migrations/20261013000000_init.sql` dosyasının tamamını yapıştır, **Run**.
3. "Success. No rows returned" görmelisin. Bu adım tabloları, Row Level Security kurallarını, kod/hesap silme fonksiyonlarını, Realtime yayınını ve `mail` Storage kovasını kurar.

4. Ardından **yeni bir sorguda** `supabase/migrations/20261014000000_task_repeat_order.sql` dosyasını yapıştır, **Run**. Bu ek; tekrarlayan görevlerde hafta/ay günü seçimini ve Görevler ekranındaki sürükle-bırak sırasını saklar. Tekrar çalıştırmak zarar vermez.

Kontrol: **Table Editor**'da 9 tablo (profiles, families, children, tasks, task_assignments, completions, messages, saved_templates, invite_codes) ve her birinde "RLS enabled" yazmalı. **Storage**'da `mail` adlı gizli (private) kova olmalı.

## 2. Anahtarlar

**Project Settings > API Keys** (eski panelde **Settings > API**):

- **Project URL** → `.env` içindeki `EXPO_PUBLIC_SUPABASE_URL`
- **Publishable key** (eski adı *anon public*) → `EXPO_PUBLIC_SUPABASE_KEY`
- `service_role` / **secret** anahtarı uygulamaya, `.env`'e ya da depoya **asla** yazılmaz.

`.env` değiştiyse Expo'yu yeniden başlat: `npx expo start -c`.

## 3. E-posta ile giriş

**Authentication > Sign In / Providers > Email**:

- **Enable Email provider**: açık
- **Confirm email**: **açık** (hoş geldin e-postası bu sayede gider; kullanıcı bağlantıya dokununca hesabı açılır)
- **Secure password change**: açık
- **Minimum password length**: `8`

**Authentication > Sign In / Providers > Anonymous Sign-Ins**: çocuk uygulaması hazır olduğunda **açık** yap (çocuk, ebeveynin ürettiği giriş koduyla anonim oturum açıp çocuğa bağlanır). Ebeveyn uygulaması için gerekmez.

## 4. Yönlendirme adresleri (deep link)

**Authentication > URL Configuration**:

- **Site URL**: `fidan://`
- **Redirect URLs** (Add URL ile tek tek ekle):
  - `fidan://**` → derlenmiş uygulama (development build / mağaza sürümü)
  - `exp://**` → Expo Go ile geliştirme

Uygulama tarafında `app.json` içinde `"expo": { "scheme": "fidan", ... }` olmalı (README'deki kurulum adımına bak).

Akış: E-postadaki bağlantı önce Supabase'in `https://…supabase.co/auth/v1/verify` adresine gider, oradan uygulamaya (`fidan://auth` ya da Expo Go'da `exp://…/--/auth`) yönlendirir. Uygulama oturumu açar; şifre yenileme bağlantısıysa "Yeni şifre belirle" ekranını gösterir. Bağlantıya uygulamanın kurulu olduğu telefondan dokunulmalı.

## 5. E-posta gönderimi (SMTP) — önemli

Supabase'in yerleşik e-posta servisi yalnızca **proje ekibindeki adreslere** ve saatte çok az sayıda e-posta gönderir; gerçek kullanıcılara e-posta gitmez.

**Project Settings > Authentication > SMTP Settings** (ya da **Authentication > Emails > SMTP Settings**) > **Enable Custom SMTP**:

- Bir e-posta servisi seç (ör. Resend, Brevo, Postmark, Amazon SES) ve alan adını orada doğrula.
- **Sender email**: `merhaba@alanadin.com`
- **Sender name**: `Fidan`
- Host, port, kullanıcı adı ve şifreyi servisin verdiği SMTP bilgilerinden doldur.

Sonra **Authentication > Rate Limits** içinde e-posta gönderim sınırını ihtiyacına göre artır (ör. saatte 30).

## 6. E-posta şablonları (Türkçe)

**Authentication > Emails > Templates**. Her şablonda **Subject** ve **Message body** (HTML) alanlarını aşağıdakilerle değiştir, **Save**.

`{{ .ConfirmationURL }}` gibi süslü parantezli ifadeler Supabase tarafından doldurulur; aynen bırak.

### Confirm signup (Hoş geldin e-postası)

**Subject**

```
Fidan'a hoş geldin 🌱
```

**Message body**

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0F1B3D">
  <p style="font-size:13px;font-weight:700;letter-spacing:1px;color:#8A91A3;margin:0">FİDAN</p>
  <h1 style="font-size:22px;margin:8px 0 16px">Hoş geldin!</h1>
  <p style="font-size:14px;line-height:22px;margin:0 0 16px">
    Fidan ailesine katıldığın için çok mutluyuz. Çocuklarına görev atayabilir,
    tamamladıklarında coin kazanmalarını ve gelişimlerini birlikte izleyebilirsiniz.
  </p>
  <p style="font-size:14px;line-height:22px;margin:0 0 24px">
    Hesabını açmak için aşağıdaki düğmeye <b>uygulamanın kurulu olduğu telefondan</b> dokun.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#0F1B3D;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 24px;border-radius:14px">
    Hesabımı aç
  </a>
  <p style="font-size:12px;line-height:18px;color:#8A91A3;margin:24px 0 0">
    Bu e-postayı sen istemediysen dikkate alma; hesap açılmaz.
  </p>
</div>
```

### Reset Password (Şifre yenileme)

**Subject**

```
Fidan şifreni yenile
```

**Message body**

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0F1B3D">
  <p style="font-size:13px;font-weight:700;letter-spacing:1px;color:#8A91A3;margin:0">FİDAN</p>
  <h1 style="font-size:22px;margin:8px 0 16px">Şifreni yenile</h1>
  <p style="font-size:14px;line-height:22px;margin:0 0 24px">
    Hesabın için şifre yenileme isteği aldık. Aşağıdaki düğmeye <b>uygulamanın kurulu olduğu telefondan</b>
    dokun; Fidan açılınca yeni şifreni belirleyebilirsin.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#0F1B3D;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 24px;border-radius:14px">
    Yeni şifre belirle
  </a>
  <p style="font-size:12px;line-height:18px;color:#8A91A3;margin:24px 0 0">
    Bağlantı bir saat geçerlidir ve yalnızca bir kez kullanılabilir.
    Bu isteği sen yapmadıysan bu e-postayı dikkate alma; şifren değişmez.
  </p>
</div>
```

### Change Email Address (E-posta değişikliği, isteğe bağlı)

**Subject**

```
Fidan e-posta adresini onayla
```

**Message body**

```html
<div style="font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0F1B3D">
  <p style="font-size:13px;font-weight:700;letter-spacing:1px;color:#8A91A3;margin:0">FİDAN</p>
  <h1 style="font-size:22px;margin:8px 0 16px">Yeni e-posta adresini onayla</h1>
  <p style="font-size:14px;line-height:22px;margin:0 0 24px">
    Hesabının e-posta adresini <b>{{ .NewEmail }}</b> olarak değiştirmek için düğmeye dokun.
  </p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;background:#0F1B3D;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:14px 24px;border-radius:14px">
    Onayla
  </a>
</div>
```

> Not: Hoş geldin e-postası, Supabase'in "Confirm signup" e-postasıdır; **Confirm email** kapalıysa gönderilmez. Kayıt onayından *ayrı*, ikinci bir hoş geldin e-postası istenirse ileride bir Edge Function + e-posta servisi ile eklenebilir.

**Authentication > Emails > Settings** (varsa) içinde **Email OTP Expiration** değerini `3600` saniye (1 saat) bırak.

## 7. Kontrol listesi

- [ ] SQL çalıştı, 9 tablo + `mail` kovası var
- [ ] `.env` dolduruldu, Expo `-c` ile yeniden başlatıldı
- [ ] Confirm email açık, minimum şifre 8
- [ ] Site URL `fidan://`, Redirect URLs `fidan://**` ve `exp://**`
- [ ] Custom SMTP ayarlandı (yoksa gerçek kullanıcılara e-posta gitmez)
- [ ] "Confirm signup" ve "Reset Password" şablonları Türkçe
- [ ] Test: kayıt ol → e-postadaki "Hesabımı aç" → uygulama açılıp giriş yapılmış olmalı
- [ ] Test: Şifremi unuttum → e-postadaki "Yeni şifre belirle" → uygulamada yeni şifre ekranı

## 8. Davet ve giriş kodları

Kodlar sunucuda üretilir (`create_invite_code`), `invite_codes` tablosunda saklanır, **tek kullanımlıktır** ve **24 saat** sonra geçersiz olur. İstemci tabloya doğrudan yazamaz.

- **İkinci ebeveyn**: Aile > + > Ebeveyn > "Davet kodu üret". Diğer ebeveyn kendi hesabıyla Aile > Hesap > **Aileye katıl** bölümüne kodu yazar (`join_family`). Katılan ebeveynin eski ailesinde başka ebeveyn yoksa o aile ve verisi silinir (uygulama önce uyarır).
- **Çocuk girişi** (çocuk uygulaması için hazır): Aile > çocuğu seç > Genel > "Giriş kodu üret". Aynı çocuk için yeni kod üretilince kullanılmamış eskisi geçersiz olur.
  Uygulamanın açılış ekranındaki **sihirli kod** alanı bu iki çağrıyı yapar. Bunun için panelde **Authentication > Sign In / Providers > Anonymous Sign-Ins** açık olmalı:

  ```ts
  await supabase.auth.signInAnonymously();
  const { data } = await supabase.rpc('redeem_child_code', { p_code: 'ABC123' });
  // data: { child_id, family_id, name, avatar }
  ```

  Bundan sonra çocuk oturumu RLS ile yalnızca kendi görevlerini, atamalarını ve mesajlarını okuyabilir; görev tamamlayabilir (inceleme gerektiren görevler "bekliyor" olarak düşer) ve mesaj gönderebilir.
