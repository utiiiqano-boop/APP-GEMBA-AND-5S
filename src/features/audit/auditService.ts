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
  image_url: string | null;
}

export interface AuditMeta {
  id: string;
  company_id: string;
  type: AuditType;
  status: 'draft' | 'submitted' | 'archived';
  ligne: string | null;
  audit_date: string | null;
  zone: string | null;
  pilote_zone: string | null;
  auditor_id: string;
  auditeur_id: string | null;
  created_at: string;
}

/* ─────────── Company / role ─────────── */

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

/* ─────────── Audit lifecycle ─────────── */

export async function getOrCreateDraftAudit(
  companyId: string,
  type: AuditType
): Promise<AuditMeta> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');

  const { data: existing, error: selErr } = await supabase
    .from('audits')
    .select('*')
    .eq('company_id', companyId)
    .eq('type', type)
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
      type,
      status: 'draft',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as AuditMeta;
}

export async function createAudit(companyId: string, type: AuditType): Promise<string> {
  const a = await getOrCreateDraftAudit(companyId, type);
  return a.id;
}

export async function updateAuditHeader(
  auditId: string,
  patch: Partial<{
    ligne: string | null;
    audit_date: string | null;
    zone: string | null;
    pilote_zone: string | null;
    auditeur_id: string | null;
    auditeur_label: string | null;
  }>
) {
  const { error } = await supabase.from('audits').update(patch).eq('id', auditId);
  if (error) throw error;
}

export async function getAuditAnswers(auditId: string): Promise<AnswerRow[]> {
  const { data, error } = await supabase
    .from('audit_answers')
    .select('*')
    .eq('audit_id', auditId);
  if (error) throw error;
  return (data ?? []) as AnswerRow[];
}

/* ─────────── Admin: plan a question ─────────── */

export async function planQuestion(input: {
  auditId: string;
  questionId: string;
  category: string;
  assigneeId: string | null;
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

/* ─────────── Auditor: answer a question ─────────── */

export async function answerQuestion(input: {
  auditId: string;
  questionId: string;
  category: string;
  answer: 'ok' | 'nok' | 'na';
  comment: string;
  imageUrl?: string | null;
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
        image_url: input.imageUrl ?? null,
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

/* ─────────── Admin results table ─────────── */

export interface SubmissionRow {
  question_id: string;
  category: string;
  answer: 'ok' | 'nok' | 'na' | null;
  comment: string | null;
  pilot: string | null;
  due_date: string | null;
  status: 'planned' | 'in_progress' | 'done';
  image_url: string | null;
}

export interface Submission {
  audit_id: string;
  ligne: string | null;
  zone: string | null;
  audit_date: string | null;
  status: 'draft' | 'submitted' | 'archived';
  created_at: string;
  auditor_email: string | null;
  auditeur_email: string | null;
  pilote_zone: string | null;
  answers: SubmissionRow[];
}

/** Kept as alias for backwards compatibility */
export type GembaRow = SubmissionRow;
export type GembaSubmission = Submission;

export async function listSubmissions(
  companyId: string,
  type: AuditType
): Promise<Submission[]> {
  const { data: audits, error: aErr } = await supabase
    .from('audits')
    .select('id, ligne, zone, audit_date, pilote_zone, status, created_at, auditor_id, auditeur_id')
    .eq('company_id', companyId)
    .eq('type', type)
    .order('created_at', { ascending: false });
  if (aErr) throw aErr;
  if (!audits || audits.length === 0) return [];

  const ids = audits.map((a: any) => a.id);

  const { data: answers } = await supabase
    .from('audit_answers')
    .select('*')
    .in('audit_id', ids);

  const { data: users } = await supabase
    .from('company_members_full')
    .select('user_id, email')
    .eq('company_id', companyId);

  const userMap = new Map<string, string>();
  (users ?? []).forEach((u: any) => userMap.set(u.user_id, u.email));

  const ansByAudit = new Map<string, any[]>();
  (answers ?? []).forEach((a: any) => {
    const arr = ansByAudit.get(a.audit_id) ?? [];
    arr.push(a);
    ansByAudit.set(a.audit_id, arr);
  });

  return audits.map((a: any) => ({
    audit_id: a.id,
    ligne: a.ligne,
    zone: a.zone,
    audit_date: a.audit_date,
    pilote_zone: a.pilote_zone,
    status: a.status,
    created_at: a.created_at,
    auditor_email: userMap.get(a.auditor_id) ?? null,
    auditeur_email: a.auditeur_id ? userMap.get(a.auditeur_id) ?? null : null,
    answers: (ansByAudit.get(a.id) ?? []).map((r: any) => ({
      question_id: r.question_id,
      category: r.category,
      answer: r.answer,
      comment: r.comment,
      pilot: r.pilot,
      due_date: r.due_date,
      status: r.status,
      image_url: r.image_url ?? null,
    })),
  }));
}
