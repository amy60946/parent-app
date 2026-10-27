// Tanışma soruları (kullanıcı kararları 27 Ekim 2026; anahtarlar ortak/sozlesme/durumlar.md P16, sürüm v1).
// Metinler referans uygulamadan çevrilmedi; ana fikir korunarak yeniden yazıldı. Hiçbir yanıt tanı ya da puan değildir.
// Değişince ortak/veri/tanisma_sorulari.json yeniden üretilir: bash tools/intake_json.sh ../ortak/veri/tanisma_sorulari.json
// {ad}: çocuğun adı (eksiz kullanılır: "Efe için", "Efe nelerden…" — Türkçe ek uyumu gerekmesin).

export const INTAKE_VERSION = 'v1';
export const HEALTH_CONSENT = 'saglik-yanit-v1';
export const HEALTH_CONSENT_TEXT = 'Çocuğumun tanısı ve ilaç kullanımı hakkındaki yanıtlarımın, uygulamanın bana ve çocuğuma uygun öneriler sunması amacıyla saklanmasına ve hizmetin yürütülmesi için yetkili ekip tarafından görülebilmesine açık rıza veriyorum. Bu soruları yanıtlamak zorunda değilim; yanıtlarımı istediğim an silebilirim.';

export type Option = { key: string; label: string; exclusive?: boolean };
export type Step =
  | { kind: 'intro'; icon: string; title: string; text: string }
  | { kind: 'note'; icon: string; title: string; text: string }
  | { kind: 'question'; key: string; title: string; prefix?: string; multi?: boolean; health?: boolean; options: Option[];
      exclude?: string }; // exclude: bu sorunun yanıtları seçeneklerden çıkarılır (ana hedef, "başka neler" sorusunda tekrar edilmez)

const FREQ: Option[] = [
  { key: 'every_day', label: 'Her gün' },
  { key: 'most_days', label: 'Çoğu gün' },
  { key: 'some_days', label: 'Bazı günler' },
  { key: 'never', label: 'Hiç' },
];

const GOALS: Option[] = [
  { key: 'motivation', label: 'Çocuğumun görevlerini isteyerek yapması' },
  { key: 'structure', label: 'Evde daha düzenli ve tutarlı bir akış' },
  { key: 'behavior', label: 'Çocuğumun davranışlarında olumlu değişim' },
  { key: 'executive', label: 'Planlama, sıraya koyma ve odaklanma becerileri' },
  { key: 'relationship', label: 'Çocuğumla daha keyifli bir ilişki' },
  { key: 'my_stress', label: 'Ebeveyn olarak daha az yorulmak' },
];

// Kayıttan sonra her ebeveyne (aile/ebeveyn soruları, child_id boş)
export const familySteps: Step[] = [
  { kind: 'intro', icon: 'chatbubbles-outline', title: 'Seni ve aileni tanıyalım',
    text: 'Birkaç kısa soru, iki üç dakika sürer. Yanıtların görev ve rutin önerilerini ailene göre ayarlamamıza yardım eder; hiçbiri not ya da puan değildir.' },
  { kind: 'question', key: 'main_goal', title: 'Şu sıralar en çok neye ihtiyacın var?', options: GOALS },
  { kind: 'question', key: 'other_goals', title: 'Bunların yanında başka neler önemli?', multi: true, exclude: 'main_goal',
    options: [...GOALS, { key: 'other', label: 'Başka bir şey' }] },
  { kind: 'question', key: 'heard_from', title: 'Bizi nereden duydun?', options: [
    { key: 'expert', label: 'Uzman, öğretmen ya da doktor' },
    { key: 'friend_family', label: 'Arkadaş ya da aile' },
    { key: 'social_ad', label: 'Instagram ya da Facebook' },
    { key: 'google', label: 'Google' },
    { key: 'app_store', label: 'App Store' },
    { key: 'tiktok', label: 'TikTok' },
    { key: 'other', label: 'Diğer' },
  ] },
  { kind: 'intro', icon: 'clipboard-outline', title: 'Ailenin temposu', text: 'Üç kısa soru, evdeki günlük akışı anlamamıza ve önerileri ailene göre ayarlamamıza yardım eder.' },
  { kind: 'question', key: 'task_conflict_freq', title: 'Görevler ve ev işleri yüzünden ne sıklıkla tartışma çıkıyor?', options: FREQ },
  { kind: 'question', key: 'reminder_freq', title: 'Bir şeyi yapması için çocuğuna ne sıklıkla hatırlatman gerekiyor?', options: FREQ },
  { kind: 'note', icon: 'leaf-outline', title: 'Bunu yaşayan tek ebeveyn sen değilsin', text: 'Hatırlatmak çoğu evin gündelik hâli. Bu yükü birlikte hafifletmek için buradayız.' },
  { kind: 'question', key: 'prompt_conflict_freq', title: 'Hatırlatmak ne sıklıkla gerginliğe ya da öfke patlamasına dönüşüyor?', options: FREQ },
];

// Çocuğu ekleyen ebeveyne, her çocuk için (child_id dolu)
export const childSteps = (name: string): Step[] => [
  { kind: 'intro', icon: 'clipboard-outline', title: `${name} hakkında birkaç soru`,
    text: `Yanıtların önerileri ${name} için ayarlamamıza yardım eder. İstersen bir soruyu atlayabilirsin.` },
  { kind: 'question', key: 'child_routine', title: `${name} için oturmuş bir günlük düzen var mı?`, options: [
    { key: 'yes', label: 'Evet' },
    { key: 'struggle', label: 'Var ama sürdürmekte zorlanıyoruz' },
    { key: 'not_really', label: 'Pek yok' },
  ] },
  { kind: 'question', key: 'child_diagnosis', title: `${name} için konmuş ya da düşündüğünüz bir tanı var mı?`, multi: true, health: true, options: [
    { key: 'adhd', label: 'Dikkat eksikliği ve hiperaktivite (DEHB)' },
    { key: 'autism', label: 'Otizm spektrumu' },
    { key: 'odd', label: 'Karşıt olma, karşı gelme' },
    { key: 'anxiety_depression', label: 'Kaygı ya da depresyon' },
    { key: 'other', label: 'Başka bir tanı' },
    { key: 'none', label: 'Tanı yok', exclusive: true },
    { key: 'prefer_not', label: 'Belirtmek istemiyorum', exclusive: true },
  ] },
  { kind: 'question', key: 'child_medication', title: `${name} düzenli kullandığı bir ilaç var mı?`, health: true, options: [
    { key: 'yes', label: 'Evet' },
    { key: 'no', label: 'Hayır' },
    { key: 'not_diagnosed', label: 'Tanı konmadı' },
    { key: 'prefer_not', label: 'Belirtmek istemiyorum' },
  ] },
  { kind: 'question', key: 'child_therapists', title: `${name} şu uzmanlardan biriyle çalışıyor mu?`, multi: true, options: [
    { key: 'behavior', label: 'Davranış terapisti' },
    { key: 'speech_ot', label: 'Dil-konuşma terapisti ya da ergoterapist' },
    { key: 'psych', label: 'Psikolog ya da psikiyatrist' },
    { key: 'other', label: 'Başka bir uzman' },
    { key: 'none', label: 'Bir uzmanla çalışmıyor', exclusive: true },
  ] },
  { kind: 'question', key: 'child_organizing', prefix: `Geçen hafta ${name} ne sıklıkla…`, title: 'işlerini sıraya koymakta zorlandı?', options: FREQ },
  { kind: 'question', key: 'child_effort_avoid', prefix: `Geçen hafta ${name} ne sıklıkla…`, title: 'uzun dikkat isteyen işlerden kaçındı?', options: FREQ },
  { kind: 'question', key: 'child_rules_argue', prefix: `Geçen hafta ${name} ne sıklıkla…`, title: 'kurallara itiraz etti ya da büyüklerle tartıştı?', options: FREQ },
  { kind: 'question', key: 'child_tantrums', prefix: `Geçen hafta ${name} ne sıklıkla…`, title: 'öfke nöbeti geçirdi ya da çabuk sinirlendi?', options: FREQ },
  { kind: 'question', key: 'child_feelings', prefix: `Geçen hafta ${name} ne sıklıkla…`, title: 'duygularını anlamakta ya da anlatmakta zorlandı?', options: FREQ },
  { kind: 'question', key: 'child_worry', prefix: `Geçen hafta ${name} ne sıklıkla…`, title: 'olmadan önce bir şeyler için endişelendi?', options: FREQ },
  { kind: 'question', key: 'child_goals', title: `${name} için hedeflerin neler?`, multi: true, options: [
    { key: 'chores', label: 'Görevlerini düzenli tamamlamak' },
    { key: 'focus', label: 'Yaptığı işe odaklanmak' },
    { key: 'impulses', label: 'Ani davranışlarını yönetmek' },
    { key: 'bedtime', label: 'Uyku saatine uymak' },
    { key: 'siblings', label: 'Kardeşleri ve ailesiyle iyi geçinmek' },
    { key: 'emotions', label: 'Duygularını daha iyi düzenlemek' },
    { key: 'other', label: 'Başka bir hedef' },
  ] },
  { kind: 'question', key: 'child_interests', title: `${name} nelerden hoşlanır?`, multi: true, options: [
    { key: 'sports', label: 'Spor ve açık havada oyun' },
    { key: 'books', label: 'Kitaplar' },
    { key: 'games_tech', label: 'Oyunlar ve teknoloji' },
    { key: 'arts', label: 'Resim ve el işi' },
    { key: 'music_dance', label: 'Müzik ve dans' },
    { key: 'animals_nature', label: 'Hayvanlar ve doğa' },
    { key: 'other', label: 'Başka bir şey' },
  ] },
  { kind: 'question', key: 'child_motivators', title: `${name} en çok neyle motive olur?`, multi: true, options: [
    { key: 'screen_time', label: 'Ekran ya da oyun süresi' },
    { key: 'allowance', label: 'Harçlık' },
    { key: 'family_activity', label: 'Aileyle bir etkinlik' },
    { key: 'friends_time', label: 'Arkadaşlarıyla fazladan oyun' },
    { key: 'treats', label: 'Küçük ikramlar' },
    { key: 'other', label: 'Başka bir şey' },
  ] },
];

// Kurulumun sonunda üç cümle (Evet / Hayır)
export const relateSteps: { key: string; quote: string; scene: 'remind' | 'chart' | 'tired' }[] = [
  { key: 'relate_reminding', quote: 'Bir işin yapılması için defalarca hatırlatmam gerekiyor.', scene: 'remind' },
  { key: 'relate_rewards_fade', quote: 'Denediğim çizelge ve ödüller bir süre işe yarıyor, sonra etkisi kayboluyor.', scene: 'chart' },
  { key: 'relate_no_energy', quote: 'Gün bittiğinde kendime ayıracak enerjim kalmıyor.', scene: 'tired' },
];
