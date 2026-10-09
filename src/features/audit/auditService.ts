import { supabase } from '../../lib/supabase';
import { AuditType } from './questions';

export type Role = 'owner' | 'admin' | 'member';

export interface CompanyMember {
  user_id: string;
  role: Role;
  full_name: string | null;
  email?: string;
}

export interface AnswerRow {
  id: string;
  audit_id: string;
  question_id: string;
  category: string;
  answer: 'ok' | 'nok' | 'na' | null;
  comment: string | null;
  assignee_id: string | null;
  due_date: string | null;
  pilot: string | null;
  status: 'planned' | 'in_progress' | 'done';
}

export async function getMyCompanyId(): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data, error } = await supabase
    .from('company_members')
    .select('company_id')
    .eq('user_id', u.user.id)
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.company_id ?? null;
}

export async function getMyRole(companyId: string): Promise<Role> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return 'member';
  const { data, error } = await supabase
    .from('company_members')
    .select('role')
    .eq('company_id', companyId)
    .eq('user_id', u.user.id)
    .maybeSingle();
  if (error) throw error;
  return (data?.role as Role) ?? 'member';
}

export async function listCompanyMembers(companyId: string): Promise<CompanyMember[]> {
  const { data, error } = await supabase
    .from('company_members_full')
    .select('user_id, role, full_name, email')
    .eq('company_id', companyId);
  if (error) throw error;
  return (data ?? []) as CompanyMember[];
}

export async function createAudit(companyId: string, type: AuditType): Promise<string> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');

  const { data: existing, error: selErr } = await supabase
    .from('audits')
    .select('id')
    .eq('company_id', companyId)
    .eq('type', type)
    .eq('status', 'draft')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (selErr) throw selErr;
  if (existing?.id) return existing.id;

  const { data, error } = await supabase
    .from('audits')
    .insert({ company_id: companyId, auditor_id: u.user.id, type, status: 'draft' })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function getAuditAnswers(auditId: string): Promise<AnswerRow[]> {
  const { data, error } = await supabase
    .from('audit_answers')
    .select('*')
    .eq('audit_id', auditId);
  if (error) throw error;
  return (data ?? []) as AnswerRow[];
}

export async function planQuestion(input: {
  auditId: string;
  questionId: string;
  category: string;
  assigneeId: string;
  dueDate: string | null;
  pilot: string;
  comment: string;
}) {
  const { error } = await supabase
    .from('audit_answers')
    .upsert(
      {
        audit_id: input.auditId,
        question_id: input.questionId,
        category: input.category,
        assignee_id: input.assigneeId,
        due_date: input.dueDate,
        pilot: input.pilot || null,
        comment: input.comment || null,
        status: 'planned',
      },
      { onConflict: 'audit_id,question_id' }
    );
  if (error) throw error;
}

export async function answerQuestion(input: {
  auditId: string;
  questionId: string;
  category: string;
  answer: 'ok' | 'nok' | 'na';
  comment: string;
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');

  const { error } = await supabase
    .from('audit_answers')
    .upsert(
      {
        audit_id: input.auditId,
        question_id: input.questionId,
        category: input.category,
        answer: input.answer,
        comment: input.comment,
        assignee_id: u.user.id,
        status: 'done',
      },
      { onConflict: 'audit_id,question_id' }
    );
  if (error) throw error;
}

export async function submitAudit(auditId: string, score?: number) {
  const { error } = await supabase
    .from('audits')
    .update({ status: 'submitted', score: score ?? null })
    .eq('id', auditId);
  if (error) throw error;
}
