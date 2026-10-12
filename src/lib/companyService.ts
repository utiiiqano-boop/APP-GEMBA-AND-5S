import { supabase } from './supabase';

export interface CompanyRegistration {
  companyName: string;
  email: string;
  password: string;
  logoUri?: string | null;
}

export interface Company {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

/* ═══════════════════════════════════════════════ */
/*  LECTURE                                         */
/* ═══════════════════════════════════════════════ */

export async function getMyCompany(): Promise<Company | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;

  const { data: membership, error: mErr } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', u.user.id)
    .limit(1)
    .maybeSingle();
  if (mErr) throw mErr;
  if (!membership?.company_id) return null;

  const { data, error } = await supabase
    .from('companies')
    .select('*')
    .eq('id', membership.company_id)
    .single();
  if (error) throw error;
  return data as Company;
}

/* ═══════════════════════════════════════════════ */
/*  MISE À JOUR                                     */
/* ═══════════════════════════════════════════════ */

export async function updateCompanyName(companyId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Le nom ne peut pas être vide');

  const { error } = await supabase
    .from('companies')
    .update({ name: trimmed })
    .eq('id', companyId);
  if (error) throw new Error(error.message + ' (' + error.code + ')');
}

export async function updateCompanyLogo(companyId: string, localUri: string) {
  const res = await fetch(localUri);
  const arrayBuffer = await res.arrayBuffer();
  const blob = new Blob([arrayBuffer]);
  const mimeFromBlob = blob.type || '';

  // Détermine l'extension depuis le MIME, pas depuis l'URL
  let ext = 'png';
  let mime = 'image/png';

  if (mimeFromBlob === 'image/jpeg') {
    ext = 'jpg';
    mime = 'image/jpeg';
  } else if (mimeFromBlob === 'image/png') {
    ext = 'png';
    mime = 'image/png';
  } else if (mimeFromBlob === 'image/webp') {
    ext = 'webp';
    mime = 'image/webp';
  } else {
    // Fallback : essaie de récupérer depuis l'URL en ignorant les segments de chemin
    const pathPart = localUri.split('/').pop() ?? '';
    const dot = pathPart.lastIndexOf('.');
    if (dot > 0) {
      const rawExt = pathPart.slice(dot + 1).toLowerCase();
      if (rawExt === 'png') { ext = 'png'; mime = 'image/png'; }
      else if (rawExt === 'jpg' || rawExt === 'jpeg') { ext = 'jpg'; mime = 'image/jpeg'; }
      else if (rawExt === 'webp') { ext = 'webp'; mime = 'image/webp'; }
    }
  }

  const path = `${companyId}/logo.${ext}`;
  console.log('[upload] path =', path, 'mime =', mime, 'size =', arrayBuffer.byteLength);

  const { error: upErr } = await supabase.storage
    .from('company-logos')
    .upload(path, arrayBuffer, { contentType: mime, upsert: true });
  if (upErr) {
    throw new Error('Upload: ' + upErr.message + ' (' + (upErr as any).statusCode + ')');
  }

  const { data } = supabase.storage.from('company-logos').getPublicUrl(path);
  const publicUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { error: upErr2 } = await supabase
    .from('companies')
    .update({ logo_url: publicUrl })
    .eq('id', companyId);
  if (upErr2) throw new Error(upErr2.message + ' (' + upErr2.code + ')');

  return publicUrl;
}

export async function removeCompanyLogo(companyId: string) {
  const { error } = await supabase
    .from('companies')
    .update({ logo_url: null })
    .eq('id', companyId);
  if (error) throw new Error(error.message);
}

/* ═══════════════════════════════════════════════ */
/*  INSCRIPTION                                     */
/* ═══════════════════════════════════════════════ */

async function uploadLogo(userId: string, uri: string): Promise<string> {
  const res = await fetch(uri);
  const arrayBuffer = await res.arrayBuffer();

  const ext = uri.split('.').pop()?.split('?')[0]?.toLowerCase() ?? 'jpg';
  const mime =
    ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg';
  const path = `${userId}/logo.${ext}`;

  const { error } = await supabase.storage
    .from('company-logos')
    .upload(path, arrayBuffer, { contentType: mime, upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from('company-logos').getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

export async function registerCompany(input: CompanyRegistration) {
  const { companyName, email, password, logoUri } = input;

  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { company_name: companyName } },
  });
  if (authError) throw authError;

  const user = authData.user;
  if (!user) throw new Error('No user returned from sign-up.');

  if (!authData.session) {
    const { data: signInData, error: signInError } =
      await supabase.auth.signInWithPassword({ email, password });
    if (signInError || !signInData.session) {
      throw new Error(
        'Compte créé. Confirmez votre email, puis connectez-vous pour finaliser la création de votre entreprise.'
      );
    }
  }

  let logoUrl: string | null = null;
  if (logoUri) {
    try {
      logoUrl = await uploadLogo(user.id, logoUri);
    } catch (e: any) {
      console.warn('Logo upload failed:', e.message);
    }
  }

  const { error: insertError } = await supabase.from('companies').insert({
    owner_id: user.id,
    name: companyName,
    logo_url: logoUrl,
  });
  if (insertError) throw new Error(`Company insert failed: ${insertError.message}`);

  return { user, companyName, logoUrl };
}
