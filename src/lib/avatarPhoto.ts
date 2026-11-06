import { useEffect, useState } from 'react';
import { supabase, MAIL_BUCKET } from './supabase';
import { readFileBytes } from './files';
import { uuid } from './uuid';

// Çocuğun fotoğrafı avatar olarak: children.avatar = 'photo:<storage yolu>' (kova 'mail', yol <family_id>/avatars/<dosya>).
// Aile (ebeveyn + çocuğun cihazı) okuyabilir; uzman göremez, ona hazır avatar gösterilir (ortak/sozlesme/durumlar.md).
export const PHOTO_PREFIX = 'photo:';
export const isPhoto = (id?: string) => !!id && id.startsWith(PHOTO_PREFIX);

export async function uploadChildPhoto(familyId: string, localUri: string, mime = 'image/jpeg') {
  const path = `${familyId}/avatars/${uuid()}.${mime.includes('png') ? 'png' : 'jpg'}`;
  const body = await readFileBytes(localUri);
  const { error } = await supabase.storage.from(MAIL_BUCKET).upload(path, body, { contentType: mime, upsert: false });
  if (error) throw new Error(error.message);
  return PHOTO_PREFIX + path;
}

// İmzalı bağlantılar 1 saat geçerli; uygulama boyunca önbellek
const cache = new Map<string, { url: string; at: number }>();
export function usePhotoUrl(id?: string) {
  const path = isPhoto(id) ? id!.slice(PHOTO_PREFIX.length) : undefined;
  const hit = path ? cache.get(path) : undefined;
  const fresh = hit && Date.now() - hit.at < 50 * 60e3 ? hit.url : undefined;
  const [url, setUrl] = useState<string | undefined>(fresh);
  useEffect(() => {
    if (!path || fresh) { setUrl(fresh); return; }
    let live = true;
    supabase.storage.from(MAIL_BUCKET).createSignedUrl(path, 3600).then(({ data }) => {
      if (!data?.signedUrl) return;
      cache.set(path, { url: data.signedUrl, at: Date.now() });
      if (live) setUrl(data.signedUrl);
    });
    return () => { live = false; };
  }, [path, fresh]);
  return url;
}
