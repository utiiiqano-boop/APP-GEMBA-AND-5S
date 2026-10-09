import { supabase } from '../../lib/supabase';
import { AuditMeta } from './auditService';

/**
 * Get or create the shared draft 5S audit for this company.
 */
export async function getOrCreateDraftAudit5S(companyId: string): Promise<AuditMeta> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');

  const { data: existing, error: selErr } = await supabase
    .from('audits')
    .select('*')
    .eq('company_id', companyId)
    .eq('type', '5s')
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing) return existing as AuditMeta;

  const { data, error } = await supabase
    .from('audits')
    .insert({
      company_id: companyId,
      auditor_id: u.user.id,
      type: '5s',
      status: 'draft',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as AuditMeta;
}

export async function updateAudit5SHeader(
  auditId: string,
  patch: {
    zone?: string | null;
    pilote_zone?: string | null;
    auditeur_label?: string | null;
    audit_date?: string | null;
  }
) {
  const { error } = await supabase.from('audits').update(patch).eq('id', auditId);
  if (error) throw error;
}
