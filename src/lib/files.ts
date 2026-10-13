import { File } from 'expo-file-system';

// Telefondaki yerel dosyayı (fotoğraf, ses kaydı) yüklemek için oku
export const readFileBytes = (uri: string): Promise<ArrayBuffer> => new File(uri).arrayBuffer();
