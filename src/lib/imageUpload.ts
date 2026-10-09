import { supabase } from './supabase';

/**
 * Upload a local file URI to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadAuditImage(
  userId: string,
  auditId: string,
  questionId: string,
  uri: string
): Promise<string> {
  const res = await fetch(uri);
  const arrayBuffer = await res.arrayBuffer();

  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const mime =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const path = `${userId}/${auditId}/${questionId}.${ext}`;

  const { error } = await supabase.storage
    .from('audit-images')
    .upload(path, arrayBuffer, { contentType: mime, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('audit-images').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}
