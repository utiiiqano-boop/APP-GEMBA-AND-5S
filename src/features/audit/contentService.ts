import { supabase } from '../../lib/supabase';
import { GEMBA_QUESTIONS, AuditQuestion } from './questions';
import {
  SECTIONS_5S,
  ALL_QUESTIONS_5S,
  Audit5SQuestion,
  Audit5SSection,
} from './questions5s';
import { LIGNES as DEFAULT_LIGNES } from './lignes';

export interface CustomQuestion {
  id: string;
  company_id: string;
  audit_type: 'gemba' | '5s';
  code: string;
  category: string;
  title: string;
  criteria: string[];
  ord: number;
  is_active: boolean;
}

export interface CustomLigne {
  id: string;
  company_id: string;
  name: string;
  ord: number;
  is_active: boolean;
}

/* ═══════════════════════════════════════════════ */
/*  LIGNES                                          */
/* ═══════════════════════════════════════════════ */

export async function listLignes(companyId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('custom_lignes')
    .select('name')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('ord', { ascending: true });
  if (error) throw error;
  if (!data || data.length === 0) return DEFAULT_LIGNES;
  return data.map((r: any) => r.name);
}

export async function listAllLignes(companyId: string): Promise<CustomLigne[]> {
  const { data, error } = await supabase
    .from('custom_lignes')
    .select('*')
    .eq('company_id', companyId)
    .order('ord', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CustomLigne[];
}

export async function createLigne(companyId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nom vide');

  const { data: last } = await supabase
    .from('custom_lignes')
    .select('ord')
    .eq('company_id', companyId)
    .order('ord', { ascending: false })
    .limit(1)
    .maybeSingle();
  const ord = (last?.ord ?? -1) + 1;

  const { error } = await supabase
    .from('custom_lignes')
    .insert({ company_id: companyId, name: trimmed, ord });
  if (error) throw new Error(error.message + ' (' + error.code + ')');
}

export async function updateLigne(id: string, name: string) {
  const { error } = await supabase
    .from('custom_lignes')
    .update({ name: name.trim() })
    .eq('id', id);
  if (error) throw new Error(error.message + ' (' + error.code + ')');
}

export async function deleteLigne(id: string) {
  console.log('[delete] ligne id =', id);

  const { data, error } = await supabase
    .from('custom_lignes')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[delete] ligne error', error);
    throw new Error(error.message + ' (' + error.code + ')');
  }

  const removed = data?.length ?? 0;
  console.log('[delete] ligne rows removed =', removed);

  if (removed === 0) {
    throw new Error(
      'Aucune ligne supprimée. Vérifie la policy DELETE sur custom_lignes et que tu es admin/owner.'
    );
  }
}

export async function seedDefaultLignes(companyId: string): Promise<number> {
  const { data: existing } = await supabase
    .from('custom_lignes')
    .select('name')
    .eq('company_id', companyId);
  const existingSet = new Set((existing ?? []).map((r: any) => r.name.toUpperCase()));

  const { data: last } = await supabase
    .from('custom_lignes')
    .select('ord')
    .eq('company_id', companyId)
    .order('ord', { ascending: false })
    .limit(1)
    .maybeSingle();
  let ord = (last?.ord ?? -1) + 1;

  const toInsert: any[] = [];
  for (const name of DEFAULT_LIGNES) {
    if (existingSet.has(name.toUpperCase())) continue;
    toInsert.push({ company_id: companyId, name, ord: ord++ });
  }
  if (toInsert.length === 0) return 0;

  const { error } = await supabase.from('custom_lignes').insert(toInsert);
  if (error) throw new Error(error.message + ' (' + error.code + ')');
  return toInsert.length;
}

/* ═══════════════════════════════════════════════ */
/*  CUSTOM QUESTIONS                                */
/* ═══════════════════════════════════════════════ */

export async function listAllCustomQuestions(
  companyId: string,
  auditType: 'gemba' | '5s'
): Promise<CustomQuestion[]> {
  const { data, error } = await supabase
    .from('custom_questions')
    .select('*')
    .eq('company_id', companyId)
    .eq('audit_type', auditType)
    .order('ord', { ascending: true });
  if (error) throw error;
  return (data ?? []) as CustomQuestion[];
}

export async function createCustomQuestion(input: {
  companyId: string;
  auditType: 'gemba' | '5s';
  code: string;
  category: string;
  title: string;
  criteria: string[];
}) {
  const code = input.code.trim();
  const category = input.category.trim();
  const title = input.title.trim();
  if (!code || !title) throw new Error('Code et titre obligatoires');

  const { data: last } = await supabase
    .from('custom_questions')
    .select('ord')
    .eq('company_id', input.companyId)
    .eq('audit_type', input.auditType)
    .order('ord', { ascending: false })
    .limit(1)
    .maybeSingle();
  const ord = (last?.ord ?? -1) + 1;

  const { error } = await supabase.from('custom_questions').insert({
    company_id: input.companyId,
    audit_type: input.auditType,
    code,
    category,
    title,
    criteria: input.criteria,
    ord,
  });
  if (error) throw new Error(error.message + ' (' + error.code + ')');
}

export async function updateCustomQuestion(
  id: string,
  patch: Partial<{
    code: string;
    category: string;
    title: string;
    criteria: string[];
    is_active: boolean;
  }>
) {
  const { error } = await supabase.from('custom_questions').update(patch).eq('id', id);
  if (error) throw new Error(error.message + ' (' + error.code + ')');
}

export async function deleteCustomQuestion(id: string) {
  console.log('[delete] question id =', id);

  const { data, error } = await supabase
    .from('custom_questions')
    .delete()
    .eq('id', id)
    .select('id');

  if (error) {
    console.error('[delete] question error', error);
    throw new Error(error.message + ' (' + error.code + ')');
  }

  const removed = data?.length ?? 0;
  console.log('[delete] question rows removed =', removed);

  if (removed === 0) {
    throw new Error(
      'Aucune question supprimée. Vérifie la policy DELETE sur custom_questions et que tu es admin/owner.'
    );
  }
}

/* ═══════════════════════════════════════════════ */
/*  IMPORT DEFAULTS                                 */
/* ═══════════════════════════════════════════════ */

export async function importDefaultGemba(companyId: string): Promise<number> {
  console.log('[import] Gemba start for company', companyId);

  const { data: existing, error: readErr } = await supabase
    .from('custom_questions')
    .select('code')
    .eq('company_id', companyId)
    .eq('audit_type', 'gemba');

  if (readErr) {
    console.error('[import] read error', readErr);
    throw new Error('read: ' + readErr.message + ' (' + readErr.code + ')');
  }

  const skip = new Set((existing ?? []).map((r: any) => r.code));
  console.log('[import] existing Gemba codes:', Array.from(skip));

  const { data: last, error: lastErr } = await supabase
    .from('custom_questions')
    .select('ord')
    .eq('company_id', companyId)
    .eq('audit_type', 'gemba')
    .order('ord', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr) console.error('[import] last ord error', lastErr);
  let ord = (last?.ord ?? -1) + 1;

  const rows: any[] = [];
  for (const q of GEMBA_QUESTIONS) {
    if (skip.has(q.id)) continue;
    rows.push({
      company_id: companyId,
      audit_type: 'gemba',
      code: q.id,
      category: q.category ?? '',
      title: q.title ?? '',
      criteria: Array.isArray(q.criteria) ? q.criteria : [],
      ord: ord++,
    });
  }

  console.log('[import] Gemba rows to insert:', rows.length);
  if (rows.length === 0) return 0;

  const { error } = await supabase.from('custom_questions').insert(rows);
  if (error) {
    console.error('[import] insert error', error);
    throw new Error('insert: ' + error.message + ' (' + error.code + ')');
  }
  console.log('[import] Gemba import OK:', rows.length);
  return rows.length;
}

export async function importDefault5S(companyId: string): Promise<number> {
  console.log('[import] 5S start for company', companyId);

  const { data: existing, error: readErr } = await supabase
    .from('custom_questions')
    .select('code')
    .eq('company_id', companyId)
    .eq('audit_type', '5s');

  if (readErr) {
    console.error('[import] read error', readErr);
    throw new Error('read: ' + readErr.message + ' (' + readErr.code + ')');
  }

  const skip = new Set((existing ?? []).map((r: any) => r.code));
  console.log('[import] existing 5S codes:', Array.from(skip));

  const { data: last, error: lastErr } = await supabase
    .from('custom_questions')
    .select('ord')
    .eq('company_id', companyId)
    .eq('audit_type', '5s')
    .order('ord', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastErr) console.error('[import] last ord error', lastErr);
  let ord = (last?.ord ?? -1) + 1;

  const rows: any[] = [];
  for (const s of SECTIONS_5S) {
    for (const q of s.questions) {
      if (skip.has(q.label)) continue;
      rows.push({
        company_id: companyId,
        audit_type: '5s',
        code: q.label,
        category: s.title ?? '',
        title: q.text ?? '',
        criteria: [],
        ord: ord++,
      });
    }
  }

  console.log('[import] 5S rows to insert:', rows.length);
  if (rows.length === 0) return 0;

  const { error } = await supabase.from('custom_questions').insert(rows);
  if (error) {
    console.error('[import] insert error', error);
    throw new Error('insert: ' + error.message + ' (' + error.code + ')');
  }
  console.log('[import] 5S import OK:', rows.length);
  return rows.length;
}

/* ═══════════════════════════════════════════════ */
/*  EFFECTIVE QUESTIONS                             */
/* ═══════════════════════════════════════════════ */

export async function getEffectiveGemba(
  companyId: string
): Promise<{ questions: AuditQuestion[]; isCustom: boolean }> {
  const customs = await listAllCustomQuestions(companyId, 'gemba');
  const active = customs.filter((c) => c.is_active);
  if (active.length === 0) return { questions: GEMBA_QUESTIONS, isCustom: false };
  return {
    questions: active.map((c) => ({
      id: c.code,
      category: c.category,
      title: c.title,
      criteria: Array.isArray(c.criteria) ? c.criteria : [],
    })),
    isCustom: true,
  };
}

export async function getEffective5S(
  companyId: string
): Promise<{ sections: Audit5SSection[]; isCustom: boolean }> {
  const customs = await listAllCustomQuestions(companyId, '5s');
  const active = customs.filter((c) => c.is_active);
  if (active.length === 0) return { sections: SECTIONS_5S, isCustom: false };

  const stepMeta: Record<string, { title: string; subtitle: string }> = {
    S1: { title: 'Eliminer', subtitle: 'Distinguer entre ce qui est utile et inutile' },
    S2: { title: 'Ranger', subtitle: 'Une place pour chaque chose et chaque chose à sa place' },
    S3: { title: 'Nettoyer', subtitle: 'Garder un lieu de travail propre' },
    S4: { title: 'Standardiser', subtitle: 'Standards et règles de travail visuelles' },
    S5: { title: 'Suivre', subtitle: 'Maintenir et respecter les standards' },
  };

  const grouped: Record<string, Audit5SQuestion[]> = {};
  for (const c of active) {
    const step = (c.code.slice(0, 2) || 'S1').toUpperCase();
    const meta = stepMeta[step] ?? stepMeta['S1'];
    grouped[step] = grouped[step] ?? [];
    const criteria = Array.isArray(c.criteria) ? c.criteria : [];
    const text = criteria.length
      ? c.title + '\n' + criteria.join('\n')
      : c.title;
    grouped[step].push({
      id: c.code,
      label: c.code,
      step,
      title: meta.title,
      subtitle: meta.subtitle,
      text,
    });
  }

  const sections: Audit5SSection[] = (['S1', 'S2', 'S3', 'S4', 'S5'] as const)
    .filter((s) => grouped[s]?.length)
    .map((s) => ({
      step: s,
      title: stepMeta[s].title,
      subtitle: stepMeta[s].subtitle,
      questions: grouped[s],
    }));

  return { sections, isCustom: true };
}
