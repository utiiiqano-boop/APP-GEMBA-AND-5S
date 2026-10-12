import { supabase } from '../../lib/supabase';

export interface ActionPlan {
  id: string;
  company_id: string;
  audit_id: string | null;
  answer_id: string | null;
  question_id: string;
  question_label: string | null;
  description: string;
  status: 'open' | 'in_progress' | 'done' | 'cancelled';
  priority: 'low' | 'medium' | 'high';
  pilot: string | null;
  due_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function listActionPlans(companyId: string): Promise<ActionPlan[]> {
  const { data, error } = await supabase
    .from('action_plans')
    .select('*')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as ActionPlan[];
}

export async function updateActionPlan(
  id: string,
  patch: Partial<Pick<ActionPlan, 'status' | 'priority' | 'pilot' | 'due_date' | 'description'>>
) {
  const { error } = await supabase.from('action_plans').update(patch).eq('id', id);
  if (error) throw error;
}

export async function createActionPlan(input: {
  companyId: string;
  auditId?: string | null;
  questionId: string;
  questionLabel?: string | null;
  description: string;
  pilot?: string | null;
  dueDate?: string | null;
  priority?: ActionPlan['priority'];
}) {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) throw new Error('Not authenticated');
  const { error } = await supabase.from('action_plans').insert({
    company_id: input.companyId,
    audit_id: input.auditId ?? null,
    question_id: input.questionId,
    question_label: input.questionLabel ?? null,
    description: input.description,
    pilot: input.pilot ?? null,
    due_date: input.dueDate ?? null,
    priority: input.priority ?? 'medium',
    created_by: u.user.id,
  });
  if (error) throw error;
}
