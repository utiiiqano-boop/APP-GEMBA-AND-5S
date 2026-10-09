import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { Platform } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Submission } from './auditService';
import { AuditQuestion, GEMBA_QUESTIONS } from './questions';
import { Audit5SQuestion, Audit5SSection, SECTIONS_5S } from './questions5s';

/* ─────────── helpers ─────────── */

function formatDate(d: string | null): string {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString(); } catch { return d; }
}

function esc(s: any): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface QItem {
  code: string;
  category: string;
  title: string;
  criteria: string[];
}

/**
 * Build the master list of questions to render.
 * Priority:
 *   1. The questions array passed by the caller (custom or default)
 *   2. Fallback to built-in defaults
 *   3. Any answer row whose question_id is not covered → fetch from custom_questions
 */
async function buildItems(
  submission: Submission,
  auditType: 'gemba' | '5s',
  gembaQuestions?: AuditQuestion[],
  fiveSSections?: Audit5SSection[],
  companyId?: string | null
): Promise<QItem[]> {
  const index = new Map<string, QItem>();

  // 1. Start with caller-provided questions
  if (auditType === 'gemba') {
    const qs = gembaQuestions?.length ? gembaQuestions : GEMBA_QUESTIONS;
    for (const q of qs) {
      index.set(q.id, {
        code: q.id,
        category: q.category,
        title: q.title,
        criteria: q.criteria ?? [],
      });
    }
  } else {
    const secs = fiveSSections?.length ? fiveSSections : SECTIONS_5S;
    for (const s of secs) {
      for (const q of s.questions) {
        index.set(q.label, {
          code: q.label,
          category: s.title,
          title: q.text,
          criteria: [],
        });
      }
    }
  }

  // 2. Add any answer rows not covered yet
  for (const a of submission.answers) {
    if (!index.has(a.question_id)) {
      index.set(a.question_id, {
        code: a.question_id,
        category: a.category ?? '',
        title: a.question_id,
        criteria: [],
      });
    }
  }

  // 3. Enrich missing titles by querying custom_questions for this company
  const missing = Array.from(index.values()).filter(
    (it) => !it.title || it.title === it.code
  );
  if (missing.length > 0 && companyId) {
    try {
      const { data } = await supabase
        .from('custom_questions')
        .select('code, category, title, criteria')
        .eq('company_id', companyId)
        .eq('audit_type', auditType)
        .in('code', missing.map((m) => m.code));

      for (const row of data ?? []) {
        const existing = index.get(row.code);
        if (existing) {
          if (!existing.title || existing.title === existing.code) {
            existing.title = row.title ?? existing.title;
          }
          if (!existing.category) existing.category = row.category ?? '';
          if ((existing.criteria ?? []).length === 0 && Array.isArray(row.criteria)) {
            existing.criteria = row.criteria;
          }
        }
      }
    } catch { /* best-effort enrichment */ }
  }

  // Preserve the natural order: known questions first, then unknown
  const knownOrder = Array.from(
    (auditType === 'gemba' ? (gembaQuestions?.length ? gembaQuestions : GEMBA_QUESTIONS) : null)?.map((q) => q.id) ?? []
  );

  return Array.from(index.values());
}

/* ═════════════════════════════════════════════════════════════════ */
/*  PDF                                                             */
/* ═════════════════════════════════════════════════════════════════ */

export async function exportSingleAuditPdf(
  submission: Submission,
  auditType: 'gemba' | '5s',
  gembaQuestions?: AuditQuestion[],
  fiveSSections?: Audit5SSection[],
  companyId?: string | null
): Promise<void> {
  const title = auditType === 'gemba' ? 'Audit Gemba' : 'Audit 5S';
  const items = await buildItems(
    submission,
    auditType,
    gembaQuestions,
    fiveSSections,
    companyId
  );

  const answersByCode: Record<string, any> = {};
  for (const a of submission.answers) answersByCode[a.question_id] = a;

  const rowsHtml = items
    .map((it, i) => {
      const a = answersByCode[it.code];
      const ans = a?.answer ? a.answer.toUpperCase() : '—';
      const color =
        a?.answer === 'ok' ? '#059669'
        : a?.answer === 'nok' ? '#DC2626'
        : a?.answer === 'na' ? '#64748B'
        : '#94A3B8';

      const criteriaHtml = (it.criteria ?? []).length
        ? `<ul class="crit">${it.criteria.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>`
        : '';

      const metaParts: string[] = [];
      if (a?.pilot) metaParts.push(`👤 ${esc(a.pilot)}`);
      if (a?.due_date) metaParts.push(`📅 ${esc(a.due_date)}`);
      const meta = metaParts.join('<br/>');

      const photo = a?.image_url
        ? `<div class="photo"><img src="${esc(a.image_url)}" /></div>`
        : '';

      const comment = a?.comment
        ? `<div class="cmt">💬 ${esc(a.comment)}</div>`
        : '';

      return `
        <tr>
          <td class="idx">${i + 1}</td>
          <td>
            <div class="code">${esc(it.code)}</div>
            <div class="cat">${esc(it.category)}</div>
            <div class="qt">${esc(it.title)}</div>
            ${criteriaHtml}
          </td>
          <td class="ansCell">
            <span class="ans ans-${(a?.answer ?? 'none').toLowerCase()}" style="color:${color}">
              ${ans}
            </span>
          </td>
          <td class="metaCell">
            ${comment}
            ${meta}
            ${photo}
          </td>
        </tr>`;
    })
    .join('');

  const html = `
  <!DOCTYPE html>
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${title}</title>
      <style>
        @page { margin: 24px; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #0F172A; }
        h1 { font-size: 22px; margin: 0 0 4px 0; }
        .sub { color: #64748B; font-size: 12px; margin-bottom: 18px; }
        .head { padding: 12px 14px; background: #EEF2FF; border-radius: 10px; margin-bottom: 16px; font-size: 12px; }
        .head div { margin: 2px 0; }
        .head b { color: #0F172A; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #E2E8F0; padding: 10px; font-size: 11px; vertical-align: top; }
        th { background: #F1F5F9; text-align: left; font-weight: 800; }
        .idx { width: 28px; text-align: center; color: #94A3B8; font-weight: 800; }
        .code { font-weight: 900; color: #2563EB; letter-spacing: 0.5px; }
        .cat { font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
        .qt { font-size: 12px; font-weight: 700; margin-bottom: 4px; }
        ul.crit { margin: 4px 0 0 16px; padding: 0; }
        ul.crit li { font-size: 10px; color: #475569; margin: 1px 0; }
        .ansCell { width: 60px; text-align: center; }
        .ans { display: inline-block; font-size: 12px; font-weight: 900; letter-spacing: 1px; padding: 3px 8px; border-radius: 6px; }
        .ans-ok { background: rgba(16,185,129,0.12); }
        .ans-nok { background: rgba(239,68,68,0.12); }
        .ans-na { background: rgba(148,163,184,0.15); }
        .metaCell { width: 210px; }
        .cmt { font-style: italic; color: #475569; margin-bottom: 6px; font-size: 11px; }
        .photo { margin-top: 6px; }
        .photo img { max-width: 200px; max-height: 200px; border-radius: 8px; }
      </style>
    </head>
    <body>
      <h1>${title}</h1>
      <div class="sub">Exporté le ${new Date().toLocaleString()}</div>
      <div class="head">
        <div><b>${esc(submission.ligne ?? submission.zone ?? 'Zone non définie')}</b></div>
        <div>Date : <b>${formatDate(submission.audit_date ?? submission.created_at)}</b></div>
        ${submission.auditeur_email ? `<div>Auditeur : <b>${esc(submission.auditeur_email)}</b></div>` : ''}
        ${submission.pilote_zone ? `<div>Pilote zone : <b>${esc(submission.pilote_zone)}</b></div>` : ''}
        <div>Statut : <b>${submission.status.toUpperCase()}</b></div>
      </div>
      <table>
        <thead>
          <tr><th>#</th><th>Question</th><th>Réponse</th><th>Détail / Preuve</th></tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </body>
  </html>`;

  const filename = `${auditType}-${(submission.ligne ?? submission.zone ?? 'audit')
    .toString()
    .replace(/[^A-Za-z0-9_-]/g, '_')}-${Date.now()}.pdf`;

  /* ─── Web: download the PDF file ─── */
  if (Platform.OS === 'web') {
    try {
      const { uri } = await Print.printToFileAsync({ html });
      // On web, uri is a blob: or data: URL
      const res = await fetch(uri);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      return;
    } catch (e) {
      // Fallback: Blob from HTML directly (still downloads an .html)
      try {
        const blob = new Blob([html], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.replace(/\.pdf$/, '.html');
        a.click();
        URL.revokeObjectURL(url);
        return;
      } catch (err) {
        throw new Error('PDF export unavailable on this platform.');
      }
    }
  }

  /* ─── Native: share the file ─── */
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${title} — ${submission.ligne ?? submission.zone ?? ''}`,
    });
  }
}

/* ═════════════════════════════════════════════════════════════════ */
/*  EXCEL                                                           */
/* ═════════════════════════════════════════════════════════════════ */

export async function exportSingleAuditExcel(
  submission: Submission,
  auditType: 'gemba' | '5s',
  gembaQuestions?: AuditQuestion[],
  fiveSSections?: Audit5SSection[],
  companyId?: string | null
): Promise<void> {
  const items = await buildItems(
    submission,
    auditType,
    gembaQuestions,
    fiveSSections,
    companyId
  );
  const answersByCode: Record<string, any> = {};
  for (const a of submission.answers) answersByCode[a.question_id] = a;

  const headerInfo = {
    Ligne: submission.ligne ?? submission.zone ?? '',
    Date: formatDate(submission.audit_date ?? submission.created_at),
    Auditeur: submission.auditeur_email ?? '',
    'Pilote zone': submission.pilote_zone ?? '',
    Statut: submission.status.toUpperCase(),
  };

  const ok = items.filter((it) => answersByCode[it.code]?.answer === 'ok').length;
  const nok = items.filter((it) => answersByCode[it.code]?.answer === 'nok').length;
  const na = items.filter((it) => answersByCode[it.code]?.answer === 'na').length;
  const done = items.filter((it) => answersByCode[it.code]?.answer).length;

  const summary = [{
    ...headerInfo,
    'Total questions': items.length,
    Répondues: done,
    OK: ok,
    NOK: nok,
    'N/A': na,
  }];

  const detail = items.map((it, i) => {
    const a = answersByCode[it.code];
    return {
      ...headerInfo,
      N: i + 1,
      Code: it.code,
      Catégorie: it.category,
      Question: it.title,
      Critères: (it.criteria ?? []).join(' | '),
      Réponse: (a?.answer ?? '').toUpperCase(),
      Commentaire: a?.comment ?? '',
      Pilote: a?.pilot ?? '',
      'Date prévue': a?.due_date ?? '',
      'Photo URL': a?.image_url ?? '',
    };
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Résumé');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(detail), 'Détail');

  const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

  const filename = `${auditType}-${(submission.ligne ?? submission.zone ?? 'audit')
    .toString()
    .replace(/[^A-Za-z0-9_-]/g, '_')}-${Date.now()}.xlsx`;

  if (Platform.OS === 'web') {
    const blob = base64ToBlob(wbout);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const path = `${FileSystem.cacheDirectory}${filename}`;
  await FileSystem.writeAsStringAsync(path, wbout, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(path, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: filename,
    });
  }
}

function base64ToBlob(base64: string): Blob {
  const byteChars = atob(base64);
  const byteArrays: Uint8Array[] = [];
  for (let i = 0; i < byteChars.length; i += 512) {
    const slice = byteChars.slice(i, i + 512);
    const bytes = new Uint8Array(slice.length);
    for (let j = 0; j < slice.length; j++) bytes[j] = slice.charCodeAt(j);
    byteArrays.push(bytes);
  }
  return new Blob(byteArrays, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
