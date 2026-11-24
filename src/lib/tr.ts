// Türkçe ek: özel adın tamlayan eki (Arven'in, Nazlı'nın, Su'nun, Gül'ün). Son ünlüye göre ı/i/u/ü;
// ünlüyle biten adda kaynaştırma n'si.
const BACK: Record<string, string> = { a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' };
export function genitive(name: string): string {
  const n = name.trim();
  const low = n.toLocaleLowerCase('tr');
  const vowels = low.match(/[aıeioöuü]/g);
  const v = vowels ? BACK[vowels[vowels.length - 1]] : 'i';
  const endsVowel = /[aıeioöuü]$/.test(low);
  return `${n}'${endsVowel ? 'n' : ''}${v}n`;
}

// "Arven", "Arven ve Nazlı", "Arven, Nazlı ve Can"
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ve ${names[names.length - 1]}`;
}

// Yönelme eki (Deniz'e, Ali'ye, Arven'e, Su'ya): son ünlü kalınsa a, inceyse e; ünlüyle biten adda kaynaştırma y'si.
export function dative(name: string): string {
  const n = name.trim();
  const low = n.toLocaleLowerCase('tr');
  const vowels = low.match(/[aıeioöuü]/g);
  const v = vowels && /[aıou]/.test(vowels[vowels.length - 1]) ? 'a' : 'e';
  return `${n}'${/[aıeioöuü]$/.test(low) ? 'y' : ''}${v}`;
}
