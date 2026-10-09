import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

export interface CompanyRegistration {
  companyName: string;
  email: string;
  password: string;
  logoUri?: string | null;
}

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
