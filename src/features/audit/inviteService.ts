import { supabase } from '../../lib/supabase';

export interface InviteCode {
  id: string;
  company_id: string;
  code: string;
  role: 'admin' | 'member';
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  max_uses: number;
  uses_count: number;
  is_active: boolean;
  created_at: string;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const pick = (n: number) =>
    Array.from({ length: n }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${pick(2)}-${pick(4)}-${pick(2)}`;
}

export async function createInviteCode(
  companyId: string,
  opts?: { role?: 'admin' | 'member'; maxUses?: number; expiresInDays?: number }
): Promise<InviteCode> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');

  const expiresAt =
    opts?.expiresInDays != null
      ? new Date(Date.now() + opts.expiresInDays * 86400000).toISOString()
      : null;

  for (let i = 0; i < 5; i++) {
    const code = generateCode();
    const { data, error } = await supabase
      .from('invite_codes')
      .insert({
        company_id: companyId,
        code,
        role: opts?.role ?? 'member',
        created_by: u.user.id,
        max_uses: opts?.maxUses ?? 1,
        expires_at: expiresAt,
      })
      .select('*')
      .single();

    if (!error) return data as InviteCode;
    if (!String(error.message).toLowerCase().includes('duplicate')) throw error;
  }
  throw new Error('Could not generate a unique code, try again');
}

export async function listInviteCodes(companyId: string): Promise<InviteCode[]> {
  const { data, error } = await supabase
    .from('invite_codes')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as InviteCode[];
}

export async function deactivateInviteCode(codeId: string) {
  const { error } = await supabase
    .from('invite_codes')
    .update({ is_active: false })
    .eq('id', codeId);
  if (error) throw error;
}

export async function deleteInviteCode(codeId: string) {
  const { error } = await supabase.from('invite_codes').delete().eq('id', codeId);
  if (error) throw error;
}

export async function redeemInviteCode(
  code: string
): Promise<{ ok: boolean; company_id?: string; error?: string }> {
  const { data, error } = await supabase.rpc('redeem_invite_code', {
    p_code: code.trim().toUpperCase(),
  });
  if (error) return { ok: false, error: error.message };
  return data as { ok: boolean; company_id?: string; error?: string };
}
