import { Share } from 'react-native';
import { File, Paths } from 'expo-file-system';

// .ics dosyasını paylaşım sayfasıyla aç (iOS: Takvim'e ekle / dosyayı kaydet). Web sürümü: calendarFile.web.ts (indirir).
export async function shareCalendarFile(name: string, ics: string) {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create();
  f.write(ics);
  await Share.share({ url: f.uri, title: 'Takvime ekle' });
}
