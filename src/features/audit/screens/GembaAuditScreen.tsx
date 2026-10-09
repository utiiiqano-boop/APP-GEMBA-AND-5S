import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../auth/AuthProvider';
import { GEMBA_QUESTIONS, AuditQuestion } from '../questions';
import {
  createAudit,
  getMyCompanyId,
  getMyRole,
  getAuditAnswers,
  planQuestion,
  answerQuestion,
  submitAudit,
  AnswerRow,
  Role,
} from '../auditService';
import { supabase } from '../../../lib/supabase';
import PlanningModal, { PlanningPayload } from '../components/PlanningModal';

type AnswerValue = 'ok' | 'nok' | 'na';

export default function GembaAuditScreen() {
  const { user } = useAuth();

  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('member');
  const [auditId, setAuditId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerRow>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [planningFor, setPlanningFor] = useState<AuditQuestion | null>(null);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  const isAdmin = role === 'owner' || role === 'admin';

  const load = useCallback(async () => {
    try {
      const cid = await getMyCompanyId();
      setCompanyId(cid);
      if (!cid) {
        Alert.alert('Erreur', 'Aucune entreprise associée à ce compte.');
        return;
      }
      const r = await getMyRole(cid);
      setRole(r);
      const id = await createAudit(cid, 'gemba');
      setAuditId(id);
      const rows = await getAuditAnswers(id);
      const map: Record<string, AnswerRow> = {};
      rows.forEach((row) => (map[row.question_id] = row));
      setAnswers(map);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await load();
      setLoading(false);
    })();
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      (async () => {
        if (companyId) await load();
      })();
    }, [companyId, load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const myAssignedQuestions = useMemo(() => {
    if (isAdmin || !user?.id) return [];
    return GEMBA_QUESTIONS.filter((q) => answers[q.id]?.assignee_id === user.id);
  }, [answers, isAdmin, user?.id]);

  const visibleQuestions = isAdmin ? GEMBA_QUESTIONS : myAssignedQuestions;

  const progress = useMemo(() => {
    const total = GEMBA_QUESTIONS.length;
    const assigned = GEMBA_QUESTIONS.filter((q) => answers[q.id]?.assignee_id).length;
    return { total, assigned };
  }, [answers]);

  const myProgress = useMemo(() => {
    const total = myAssignedQuestions.length;
    const done = myAssignedQuestions.filter((q) => answers[q.id]?.status === 'done').length;
    return { total, done, pct: total ? done / total : 0 };
  }, [myAssignedQuestions, answers]);

  const openPlanning = (q: AuditQuestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlanningFor(q);
  };

  const confirmPlanning = async (payload: PlanningPayload) => {
    if (!planningFor || !auditId) return;
    const q = planningFor;
    try {
      await planQuestion({
        auditId,
        questionId: q.id,
        category: q.category,
        assigneeId: payload.assigneeId,
        dueDate: payload.dueDate,
        pilot: payload.pilot,
        comment: payload.comment,
      });
      setAnswers((s) => ({
        ...s,
        [q.id]: {
          ...(s[q.id] ?? ({} as AnswerRow)),
          id: s[q.id]?.id ?? '',
          audit_id: auditId,
          question_id: q.id,
          category: q.category,
          assignee_id: payload.assigneeId,
          due_date: payload.dueDate,
          pilot: payload.pilot,
          comment: payload.comment || null,
          status: 'planned',
          answer: null,
        } as AnswerRow,
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    }
  };

  const patchRow = (q: AuditQuestion, patch: Partial<AnswerRow>) => {
    setAnswers((s) => ({
      ...s,
      [q.id]: {
        ...(s[q.id] ??
          ({
            id: '',
            audit_id: auditId ?? '',
            question_id: q.id,
            category: q.category,
            assignee_id: user?.id ?? null,
            due_date: null,
            pilot: null,
            answer: null,
            comment: '',
            status: 'planned',
          } as AnswerRow)),
        ...patch,
      } as AnswerRow,
    }));
  };

  const setAnswer = (q: AuditQuestion, value: AnswerValue) => {
    Haptics.selectionAsync();
    setErrors((e) => ({ ...e, [q.id]: '' }));
    patchRow(q, { answer: value, status: 'done' });
  };

  const setComment = (q: AuditQuestion, text: string) => {
    setErrors((e) => ({ ...e, [q.id]: '' }));
    patchRow(q, { comment: text });
  };

  const setPilot = (q: AuditQuestion, text: string) => {
    setErrors((e) => ({ ...e, [q.id]: '' }));
    patchRow(q, { pilot: text });
  };

  const setDueDate = (q: AuditQuestion, text: string) => {
    setErrors((e) => ({ ...e, [q.id]: '' }));
    patchRow(q, { due_date: text });
  };

  const saveRow = async (q: AuditQuestion) => {
    if (!auditId) return;
    const row = answers[q.id];
    if (!row?.answer) return;

    if (row.answer === 'nok') {
      const problems: string[] = [];
      if (!(row.comment ?? '').trim()) problems.push('commentaire');
      if (!(row.pilot ?? '').trim()) problems.push('pilote');
      if (!(row.due_date ?? '').trim()) problems.push('date prévue');
      if (problems.length > 0) {
        setErrors((e) => ({ ...e, [q.id]: `Requis pour NOK : ${problems.join(', ')}` }));
        return;
      }
    }

    try {
      await answerQuestion({
        auditId,
        questionId: q.id,
        category: q.category,
        answer: row.answer,
        comment: row.comment ?? '',
      });
      if (row.answer === 'nok') {
        await supabase
          .from('audit_answers')
          .update({ pilot: row.pilot, due_date: row.due_date })
          .eq('audit_id', auditId)
          .eq('question_id', q.id);
      }
    } catch (e: any) {
      console.warn('saveRow error:', e);
    }
  };

  const handleSubmit = async () => {
    if (!auditId) {
      Alert.alert('Erreur', 'Audit introuvable.');
      return;
    }

    const problems: Record<string, string> = {};
    for (const q of myAssignedQuestions) {
      const row = answers[q.id];
      if (!row?.answer) {
        problems[q.id] = 'Réponse requise';
        continue;
      }
      if (row.answer === 'nok') {
        const miss: string[] = [];
        if (!(row.comment ?? '').trim()) miss.push('commentaire');
        if (!(row.pilot ?? '').trim()) miss.push('pilote');
        if (!(row.due_date ?? '').trim()) miss.push('date prévue');
        if (miss.length > 0) problems[q.id] = `Requis pour NOK : ${miss.join(', ')}`;
      }
    }

    if (Object.keys(problems).length > 0) {
      setErrors(problems);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Formulaire incomplet', 'Corrigez les champs signalés.');
      return;
    }

    setSubmitBusy(true);
    try {
      for (const q of myAssignedQuestions) {
        await saveRow(q);
      }
      await submitAudit(auditId, 100);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      Alert.alert('Merci !', 'Vos réponses ont été enregistrées.', [
        { text: 'OK', onPress: () => router.replace('/(app)') },
      ]);
    } catch (e: any) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Erreur à la soumission', e?.message ?? 'Réessayez.');
    } finally {
      setSubmitBusy(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" size="large" />
        <Text style={styles.centerText}>Chargement…</Text>
      </View>
    );
  }

  if (!isAdmin && visibleQuestions.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>📭</Text>
        <Text style={styles.emptyTitle}>Aucune question assignée</Text>
        <Text style={styles.emptyText}>
          L'administrateur n'a pas encore planifié de questions pour vous.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.headerTitle}>Audit Gemba</Text>
            <Text style={styles.headerSub}>
              {isAdmin ? 'Mode administrateur' : 'Mes questions assignées'}
            </Text>
          </View>
          <View style={[styles.rolePill, isAdmin ? styles.rolePillAdmin : styles.rolePillMember]}>
            <Text style={styles.rolePillText}>{isAdmin ? 'ADMIN' : 'AUDITEUR'}</Text>
          </View>
        </View>
        {isAdmin ? (
          <>
            <Text style={styles.headerStat}>
              {progress.assigned} / {progress.total} questions planifiées
            </Text>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#7C3AED', '#A855F7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${(progress.assigned / progress.total) * 100}%` }]}
              />
            </View>
          </>
        ) : (
          <>
            <Text style={styles.headerStat}>
              {myProgress.done} / {myProgress.total} répondues
            </Text>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#3B82F6', '#06B6D4']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${myProgress.pct * 100}%` }]}
              />
            </View>
          </>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {visibleQuestions.map((q, i) => {
          const row = answers[q.id];
          const assigned = !!row?.assignee_id;
          const err = errors[q.id];
          const isNok = row?.answer === 'nok';

          return (
            <Animated.View
              key={q.id}
              entering={FadeInDown.delay(i * 40).duration(400)}
              style={styles.card}
            >
              <View style={styles.cardHeader}>
                <View style={styles.catChip}>
                  <Text style={styles.catChipText}>{q.category}</Text>
                </View>
                <Text style={styles.qIndex}>
                  Q{i + 1}/{visibleQuestions.length}
                </Text>
              </View>

              <Text style={styles.qTitle}>{q.title}</Text>

              {q.criteria.map((c, ci) => (
                <View key={ci} style={styles.criterionRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.criterionText}>{c}</Text>
                </View>
              ))}

              {isAdmin ? (
                <View style={styles.adminBlock}>
                  {assigned ? (
                    <>
                      <View style={styles.assignedRow}>
                        <View
                          style={[
                            styles.statusDot,
                            row?.answer === 'ok' && { backgroundColor: '#10B981' },
                            row?.answer === 'nok' && { backgroundColor: '#EF4444' },
                            row?.answer === 'na' && { backgroundColor: '#94A3B8' },
                            !row?.answer && { backgroundColor: '#7C3AED' },
                          ]}
                        />
                        <Text style={styles.assignedText}>
                          {row?.answer ? `Répondu : ${row.answer.toUpperCase()}` : 'Planifié'}
                          {row?.pilot ? ` · Pilote : ${row.pilot}` : ''}
                          {row?.due_date ? ` · ${row.due_date}` : ''}
                        </Text>
                      </View>
                      {row?.comment ? <Text style={styles.adminComment}>💬 {row.comment}</Text> : null}
                      <TouchableOpacity
                        style={styles.planningBtn}
                        onPress={() => openPlanning(q)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.planningIcon}>✎</Text>
                        <Text style={styles.planningText}>Modifier le planning</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.planningBtn, styles.planningBtnPrimary]}
                      onPress={() => openPlanning(q)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.planningIcon}>📅</Text>
                      <Text style={[styles.planningText, styles.planningTextPrimary]}>Planifier</Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                <>
                  <Text style={styles.sectionLabel}>VOTRE RÉPONSE</Text>
                  <View style={styles.seg}>
                    {(['ok', 'nok', 'na'] as AnswerValue[]).map((val) => {
                      const active = row?.answer === val;
                      const color = val === 'ok' ? '#10B981' : val === 'nok' ? '#EF4444' : '#94A3B8';
                      return (
                        <TouchableOpacity
                          key={val}
                          onPress={() => setAnswer(q, val)}
                          style={[styles.segBtn, active && { backgroundColor: color + '20', borderColor: color }]}
                          activeOpacity={0.85}
                        >
                          <Text style={[styles.segText, active && { color, fontWeight: '900' }]}>
                            {val === 'na' ? 'N/A' : val.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.sectionLabel}>
                    COMMENTAIRE
                    {isNok ? <Text style={styles.requiredTag}> — OBLIGATOIRE</Text> : <Text style={styles.optionalTag}> — optionnel</Text>}
                  </Text>
                  <TextInput
                    placeholder={isNok ? 'Expliquez le problème constaté…' : 'Ajoutez un commentaire si nécessaire…'}
                    placeholderTextColor="#94A3B8"
                    value={row?.comment ?? ''}
                    onChangeText={(t) => setComment(q, t)}
                    onBlur={() => saveRow(q)}
                    style={[
                      styles.commentInput,
                      isNok && !(row?.comment ?? '').trim() && err ? { borderColor: '#EF4444', borderWidth: 1.5 } : null,
                    ]}
                    multiline
                  />

                  <Text style={styles.sectionLabel}>
                    PILOTE
                    {isNok ? <Text style={styles.requiredTag}> — OBLIGATOIRE</Text> : <Text style={styles.optionalTag}> — modifiable</Text>}
                  </Text>
                  <TextInput
                    placeholder="Nom du pilote"
                    placeholderTextColor="#94A3B8"
                    value={row?.pilot ?? ''}
                    onChangeText={(t) => setPilot(q, t)}
                    onBlur={() => saveRow(q)}
                    style={[
                      styles.lineInput,
                      isNok && !(row?.pilot ?? '').trim() && err ? { borderColor: '#EF4444', borderWidth: 1.5 } : null,
                    ]}
                  />

                  <Text style={styles.sectionLabel}>
                    DATE PRÉVUE
                    {isNok ? <Text style={styles.requiredTag}> — OBLIGATOIRE</Text> : <Text style={styles.optionalTag}> — modifiable</Text>}
                  </Text>
                  <TextInput
                    placeholder="AAAA-MM-JJ"
                    placeholderTextColor="#94A3B8"
                    value={row?.due_date ?? ''}
                    onChangeText={(t) => setDueDate(q, t)}
                    onBlur={() => saveRow(q)}
                    style={[
                      styles.lineInput,
                      isNok && !(row?.due_date ?? '').trim() && err ? { borderColor: '#EF4444', borderWidth: 1.5 } : null,
                    ]}
                  />

                  {err ? <Text style={styles.errorText}>{err}</Text> : null}
                </>
              )}
            </Animated.View>
          );
        })}

        {!isAdmin && myProgress.total > 0 && !submitted && (
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={submitBusy}
            activeOpacity={0.9}
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB', '#1E40AF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGrad}
            >
              {submitBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>SOUMETTRE MES RÉPONSES</Text>}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {submitted && (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Audit soumis</Text>
            <Text style={styles.successText}>Vos réponses ont été enregistrées avec succès.</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <PlanningModal
        visible={!!planningFor}
        companyId={companyId}
        onClose={() => setPlanningFor(null)}
        onConfirm={confirmPlanning}
        questionTitle={planningFor?.title ?? ''}
        initial={
          planningFor
            ? {
                assigneeId: answers[planningFor.id]?.assignee_id,
                dueDate: answers[planningFor.id]?.due_date,
                pilot: answers[planningFor.id]?.pilot,
                comment: answers[planningFor.id]?.comment,
              }
            : undefined
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  centerText: { color: '#64748B', fontWeight: '600', marginTop: 12 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
  header: { padding: 20, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  headerSub: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 2 },
  headerStat: { fontSize: 13, color: '#64748B', fontWeight: '700', marginTop: 12 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rolePillAdmin: { backgroundColor: 'rgba(124,58,237,0.15)' },
  rolePillMember: { backgroundColor: 'rgba(37,99,235,0.15)' },
  rolePillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#1E293B' },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  scroll: { padding: 16, paddingBottom: 80 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  catChip: { backgroundColor: 'rgba(37,99,235,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  catChipText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.5, color: '#2563EB', textTransform: 'uppercase' },
  qIndex: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  qTitle: { fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 10, lineHeight: 23 },
  criterionRow: { flexDirection: 'row', marginBottom: 5 },
  bullet: { color: '#2563EB', fontWeight: '900', marginRight: 8, fontSize: 14 },
  criterionText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 19 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 1.5, marginTop: 16, marginBottom: 8 },
  requiredTag: { color: '#EF4444', fontWeight: '900' },
  optionalTag: { color: '#94A3B8', fontWeight: '600' },
  seg: { flexDirection: 'row', gap: 8 },
  segBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
  segText: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: '#94A3B8' },
  commentInput: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0F172A', minHeight: 60, textAlignVertical: 'top' },
  lineInput: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#0F172A' },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '700', marginTop: 8 },
  adminBlock: { marginTop: 14 },
  assignedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  assignedText: { fontSize: 13, color: '#334155', fontWeight: '700', flex: 1 },
  adminComment: { fontSize: 12, color: '#64748B', marginTop: 4, marginBottom: 8, fontStyle: 'italic' },
  planningBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, backgroundColor: 'rgba(124,58,237,0.08)', borderWidth: 1, borderColor: 'rgba(124,58,237,0.3)', marginTop: 6 },
  planningBtnPrimary: { backgroundColor: 'rgba(37,99,235,0.1)', borderColor: 'rgba(37,99,235,0.4)' },
  planningIcon: { fontSize: 16, marginRight: 8 },
  planningText: { flex: 1, color: '#7C3AED', fontWeight: '800', fontSize: 13, letterSpacing: 0.5 },
  planningTextPrimary: { color: '#2563EB' },
  submitBtn: { marginTop: 12, borderRadius: 16, overflow: 'hidden', shadowColor: '#1E40AF', shadowOpacity: 0.35, shadowRadius: 16, shadowOffset: { width: 0, height: 10 } },
  submitGrad: { paddingVertical: 18, alignItems: 'center' },
  submitText: { color: '#FFF', fontWeight: '900', letterSpacing: 2, fontSize: 14 },
  successCard: { marginTop: 16, padding: 24, backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', borderRadius: 16, alignItems: 'center' },
  successIcon: { fontSize: 40, marginBottom: 8 },
  successTitle: { fontSize: 18, fontWeight: '900', color: '#059669', letterSpacing: 1 },
  successText: { fontSize: 13, color: '#475569', textAlign: 'center', marginTop: 6 },
});
