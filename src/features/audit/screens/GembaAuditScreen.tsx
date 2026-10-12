import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthProvider';
import { AuditQuestion } from '../questions';
import { getEffectiveGemba, listLignes } from '../contentService';
import {
  getOrCreateDraftAudit, getMyCompanyId, getMyRole,
  getAuditAnswers, answerQuestion, submitAudit,
  updateAuditHeader, planQuestion, computeScore, saveAuditScore,
  AnswerRow, AuditMeta, Role,
} from '../auditService';
import { uploadAuditImage } from '../../../lib/imageUpload';
import PlanningModal, { PlanningPayload } from '../components/PlanningModal';
import QuestionCard from '../../../components/QuestionCard';
import { colors, font, radius, shadow, spacing } from '../../../theme';

type AnswerValue = 'ok' | 'nok' | 'na';

export default function GembaAuditScreen() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('member');
  const [audit, setAudit] = useState<AuditMeta | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerRow>>({});
  const [gembaQuestions, setGembaQuestions] = useState<AuditQuestion[]>([]);
  const [lignesList, setLignesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [ligneModal, setLigneModal] = useState(false);
  const [planningFor, setPlanningFor] = useState<AuditQuestion | null>(null);

  const isAdmin = role === 'owner' || role === 'admin';

  const load = useCallback(async () => {
    try {
      const cid = await getMyCompanyId();
      setCompanyId(cid);
      if (!cid) return;
      setRole(await getMyRole(cid));
      const a = await getOrCreateDraftAudit(cid, 'gemba');
      setAudit(a);
      const [rows, qR, lR] = await Promise.all([
        getAuditAnswers(a.id), getEffectiveGemba(cid), listLignes(cid),
      ]);
      setGembaQuestions(qR.questions);
      setLignesList(lR);
      const map: Record<string, AnswerRow> = {};
      rows.forEach((r) => (map[r.question_id] = r));
      setAnswers(map);
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);
  useFocusEffect(useCallback(() => { (async () => { if (companyId) await load(); })(); }, [companyId, load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const setLigne = async (l: string) => {
    if (!audit) return;
    setLigneModal(false);
    try {
      await updateAuditHeader(audit.id, { ligne: l });
      setAudit({ ...audit, ligne: l });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  };

  const confirmPlanning = async (payload: PlanningPayload) => {
    if (!planningFor || !audit) return;
    const q = planningFor;
    try {
      await planQuestion({
        auditId: audit.id, questionId: q.id, category: q.category,
        assigneeId: payload.assigneeId, dueDate: payload.dueDate,
        pilot: payload.pilot, comment: payload.comment,
      });
      setAnswers((s) => ({
        ...s, [q.id]: {
          ...(s[q.id] ?? {} as AnswerRow),
          id: s[q.id]?.id ?? '', audit_id: audit.id, question_id: q.id,
          category: q.category, assignee_id: payload.assigneeId,
          due_date: payload.dueDate, pilot: payload.pilot,
          comment: payload.comment || null, status: 'planned', answer: null,
          image_url: null,
        } as AnswerRow,
      }));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  };

  const myAssigned = useMemo(() => {
    if (isAdmin || !user?.id) return [];
    return gembaQuestions.filter((q) => answers[q.id]?.assignee_id === user.id);
  }, [answers, isAdmin, user?.id, gembaQuestions]);

  const visible = isAdmin ? gembaQuestions : myAssigned;

  const myProgress = useMemo(() => {
    const total = myAssigned.length;
    const done = myAssigned.filter((q) => answers[q.id]?.status === 'done').length;
    return { total, done, pct: total ? done / total : 0 };
  }, [myAssigned, answers]);

  const patch = (q: AuditQuestion, p: Partial<AnswerRow>) => {
    setAnswers((s) => ({
      ...s, [q.id]: {
        ...(s[q.id] ?? {
          id: '', audit_id: audit?.id ?? '', question_id: q.id, category: q.category,
          assignee_id: user?.id ?? null, due_date: null, pilot: null,
          answer: null, comment: '', status: 'planned', image_url: null,
        } as AnswerRow),
        ...p,
      } as AnswerRow,
    }));
  };

  const onAnswer = (q: AuditQuestion, v: AnswerValue) => {
    setErrors((e) => ({ ...e, [q.id]: '' }));
    patch(q, { answer: v, status: 'done' });
  };
  const onComment = (q: AuditQuestion, t: string) => { setErrors((e) => ({ ...e, [q.id]: '' })); patch(q, { comment: t }); };
  const onPilot = (q: AuditQuestion, t: string) => { setErrors((e) => ({ ...e, [q.id]: '' })); patch(q, { pilot: t }); };
  const onDate = (q: AuditQuestion, t: string) => { setErrors((e) => ({ ...e, [q.id]: '' })); patch(q, { due_date: t }); };

  const pickImage = async (q: AuditQuestion) => {
    if (!audit || !user?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', 'Autorisez les photos.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.75 });
    if (r.canceled || !r.assets[0]) return;
    setUploadingFor(q.id);
    try {
      const url = await uploadAuditImage(user.id, audit.id, q.id, r.assets[0].uri);
      patch(q, { image_url: url });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert('Upload échoué', e.message); }
    finally { setUploadingFor(null); }
  };

  const saveRow = async (q: AuditQuestion) => {
    if (!audit) return;
    const row = answers[q.id];
    if (!row?.answer) return;
    if (row.answer === 'nok') {
      const miss: string[] = [];
      if (!(row.comment ?? '').trim()) miss.push('commentaire');
      if (!(row.pilot ?? '').trim()) miss.push('pilote');
      if (!(row.due_date ?? '').trim()) miss.push('date');
      if (!row.image_url) miss.push('image');
      if (miss.length) {
        setErrors((e) => ({ ...e, [q.id]: `Requis : ${miss.join(', ')}` }));
        return;
      }
    }
    try {
      await answerQuestion({
        auditId: audit.id, questionId: q.id, category: q.category,
        answer: row.answer, comment: row.comment ?? '', imageUrl: row.image_url,
      });
    } catch (e) { console.warn(e); }
  };

  const handleSubmit = async () => {
    if (!audit) return;
    const problems: Record<string, string> = {};
    for (const q of myAssigned) {
      const row = answers[q.id];
      if (!row?.answer) { problems[q.id] = 'Réponse requise'; continue; }
      if (row.answer === 'nok') {
        const miss: string[] = [];
        if (!(row.comment ?? '').trim()) miss.push('commentaire');
        if (!(row.pilot ?? '').trim()) miss.push('pilote');
        if (!(row.due_date ?? '').trim()) miss.push('date');
        if (!row.image_url) miss.push('image');
        if (miss.length) problems[q.id] = `Requis : ${miss.join(', ')}`;
      }
    }
    if (Object.keys(problems).length) {
      setErrors(problems);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Formulaire incomplet', 'Corrigez les champs signalés.');
      return;
    }
    setSubmitBusy(true);
    try {
      for (const q of myAssigned) await saveRow(q);
      const final = Object.values(answers) as AnswerRow[];
      const sc = computeScore(final);
      await saveAuditScore(audit.id, sc);
      await submitAudit(audit.id, sc.score);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      Alert.alert('Merci !', `Score : ${sc.score.toFixed(1)} % (${sc.total_ok}/${sc.total_scored} OK)`, [
        { text: 'OK', onPress: () => router.replace('/(app)') },
      ]);
    } catch (e: any) { Alert.alert('Erreur', e?.message ?? 'Réessayez.'); }
    finally { setSubmitBusy(false); }
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Audit Gemba</Text>
            <Text style={styles.headerSub}>
              {isAdmin ? 'Assignez chaque question' : 'Mes questions assignées'}
            </Text>
          </View>
          <View style={[styles.rolePill, isAdmin ? styles.roleAdmin : styles.roleMember]}>
            <Text style={styles.roleText}>{isAdmin ? 'ADMIN' : 'AUDITEUR'}</Text>
          </View>
        </View>

        {/* Ligne */}
        <TouchableOpacity
          style={styles.ligneBand}
          onPress={() => isAdmin && setLigneModal(true)}
          disabled={!isAdmin}
          activeOpacity={0.85}
        >
          <View style={styles.ligneLeft}>
            <View style={styles.ligneIcon}>
              <Feather name="map-pin" size={16} color={colors.primary} />
            </View>
            <View>
              <Text style={styles.ligneLabel}>LIGNE</Text>
              <Text style={[styles.ligneValue, !audit?.ligne && isAdmin && { color: colors.danger }]}>
                {audit?.ligne || (isAdmin ? 'Choisir une ligne' : '—')}
              </Text>
            </View>
          </View>
          {isAdmin && <Feather name="chevron-right" size={20} color={colors.gray[400]} />}
        </TouchableOpacity>

        {/* Progress */}
        {!isAdmin && myProgress.total > 0 && (
          <View style={styles.progressWrap}>
            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>Progression</Text>
              <Text style={styles.progressValue}>{myProgress.done} / {myProgress.total}</Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={[colors.primary, '#06B6D4']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${myProgress.pct * 100}%` }]}
              />
            </View>
          </View>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {!isAdmin && visible.length === 0 && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Feather name="inbox" size={36} color={colors.gray[400]} />
            </View>
            <Text style={styles.emptyTitle}>Aucune question assignée</Text>
            <Text style={styles.emptyText}>
              L'administrateur n'a pas encore planifié de questions pour vous.
            </Text>
          </View>
        )}

        {isAdmin && (
          <>
            {visible.map((q, i) => {
              const row = answers[q.id];
              const assigned = !!row?.assignee_id;
              return (
                <View key={q.id} style={styles.adminCard}>
                  <View style={styles.adminCardHead}>
                    <Text style={styles.adminIndex}>Q{i + 1}</Text>
                    <View style={styles.adminChip}>
                      <Text style={styles.adminChipText}>{q.category}</Text>
                    </View>
                  </View>
                  <Text style={styles.adminTitle}>{q.title}</Text>
                  {assigned ? (
                    <>
                      <View style={styles.assignedRow}>
                        <View style={[styles.statusDot, {
                          backgroundColor:
                            row?.answer === 'ok' ? colors.success :
                            row?.answer === 'nok' ? colors.danger :
                            row?.answer === 'na' ? colors.gray[400] : colors.admin,
                        }]} />
                        <Text style={styles.assignedText}>
                          {row?.answer ? `Répondu : ${row.answer.toUpperCase()}` : 'Planifié'}
                          {row?.pilot ? ` · ${row.pilot}` : ''}
                        </Text>
                      </View>
                      <TouchableOpacity style={styles.adminBtn} onPress={() => setPlanningFor(q)}>
                        <Feather name="edit-2" size={14} color={colors.admin} />
                        <Text style={[styles.adminBtnText, { color: colors.admin }]}>Modifier</Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.adminBtn, styles.adminBtnPrimary]}
                      onPress={() => setPlanningFor(q)}
                    >
                      <Feather name="user-plus" size={14} color={colors.primary} />
                      <Text style={[styles.adminBtnText, { color: colors.primary }]}>Assigner un utilisateur</Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </>
        )}

        {!isAdmin && visible.map((q, i) => {
          const row = answers[q.id];
          return (
            <QuestionCard
              key={q.id}
              index={i}
              total={visible.length}
              category={q.category}
              title={q.title}
              criteria={q.criteria}
              answer={row?.answer ?? null}
              comment={row?.comment ?? ''}
              pilot={row?.pilot ?? ''}
              dueDate={row?.due_date ?? ''}
              imageUrl={row?.image_url}
              error={errors[q.id]}
              uploading={uploadingFor === q.id}
              onChangeAnswer={(v) => onAnswer(q, v)}
              onChangeComment={(t) => onComment(q, t)}
              onChangePilot={(t) => onPilot(q, t)}
              onChangeDueDate={(t) => onDate(q, t)}
              onPickImage={() => pickImage(q)}
              onRemoveImage={() => patch(q, { image_url: null })}
              onBlurSave={() => saveRow(q)}
            />
          );
        })}

        {!isAdmin && myProgress.total > 0 && !submitted && (
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitBusy} activeOpacity={0.9}>
            <LinearGradient
              colors={[colors.primary, colors.primaryDark]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
              style={styles.submitGrad}
            >
              {submitBusy ? <ActivityIndicator color={colors.white} /> : (
                <>
                  <Feather name="send" size={18} color={colors.white} />
                  <Text style={styles.submitText}>SOUMETTRE</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {submitted && (
          <View style={styles.successCard}>
            <Feather name="check-circle" size={32} color={colors.success} />
            <Text style={styles.successTitle}>Audit soumis</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Ligne modal */}
      <Modal visible={ligneModal} transparent animationType="fade" onRequestClose={() => setLigneModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choisir une ligne</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {lignesList.map((l) => {
                const active = audit?.ligne === l;
                return (
                  <TouchableOpacity
                    key={l}
                    style={[styles.pickerRow, active && styles.pickerRowActive]}
                    onPress={() => setLigne(l)}
                  >
                    <Text style={[styles.pickerText, active && { color: colors.primary, fontFamily: font.bold }]}>
                      {l}
                    </Text>
                    {active && <Feather name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setLigneModal(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <PlanningModal
        visible={!!planningFor}
        companyId={companyId}
        onClose={() => setPlanningFor(null)}
        onConfirm={confirmPlanning}
        questionTitle={planningFor ? `${planningFor.category} — ${planningFor.title}` : ''}
        initial={planningFor ? {
          assigneeId: answers[planningFor.id]?.assignee_id,
          dueDate: answers[planningFor.id]?.due_date,
          pilot: answers[planningFor.id]?.pilot,
          comment: answers[planningFor.id]?.comment,
        } : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.gray[50] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  header: { backgroundColor: colors.white, padding: spacing.xl, borderBottomWidth: 1, borderBottomColor: colors.gray[200], ...shadow.xs },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontFamily: font.black, color: colors.gray[900], letterSpacing: -0.3 },
  headerSub: { fontSize: 12, fontFamily: font.medium, color: colors.gray[500], marginTop: 2 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: radius.sm },
  roleAdmin: { backgroundColor: colors.adminSoft },
  roleMember: { backgroundColor: colors.primarySoft },
  roleText: { fontSize: 10, fontFamily: font.extrabold, letterSpacing: 1.5, color: colors.gray[700] },

  ligneBand: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.primarySoft, borderRadius: radius.lg, padding: spacing.md,
    marginTop: spacing.lg, borderWidth: 1, borderColor: '#DBEAFE',
  },
  ligneLeft: { flexDirection: 'row', alignItems: 'center' },
  ligneIcon: { width: 36, height: 36, borderRadius: radius.md, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md },
  ligneLabel: { fontSize: 10, fontFamily: font.extrabold, color: colors.gray[500], letterSpacing: 1.8 },
  ligneValue: { fontSize: 16, fontFamily: font.black, color: colors.gray[900], marginTop: 2 },

  progressWrap: { marginTop: spacing.lg },
  progressHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 11, fontFamily: font.extrabold, color: colors.gray[400], letterSpacing: 1.5 },
  progressValue: { fontSize: 12, fontFamily: font.bold, color: colors.gray[700] },
  progressTrack: { height: 8, backgroundColor: colors.gray[100], borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },

  scroll: { padding: spacing.lg, paddingBottom: 80 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.gray[100], alignItems: 'center', justifyContent: 'center', marginBottom: spacing.lg },
  emptyTitle: { fontSize: 17, fontFamily: font.extrabold, color: colors.gray[900] },
  emptyText: { fontSize: 13, fontFamily: font.regular, color: colors.gray[500], textAlign: 'center', marginTop: 6, paddingHorizontal: 32, lineHeight: 19 },

  adminCard: { backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm },
  adminCardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm },
  adminIndex: { fontSize: 11, fontFamily: font.black, color: colors.gray[400], letterSpacing: 1 },
  adminChip: { backgroundColor: colors.primarySoft, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.sm },
  adminChipText: { fontSize: 9, fontFamily: font.extrabold, color: colors.primary, letterSpacing: 1.5, textTransform: 'uppercase' },
  adminTitle: { fontSize: 14, fontFamily: font.bold, color: colors.gray[900], marginBottom: spacing.md, lineHeight: 19 },

  assignedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.sm },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  assignedText: { fontSize: 12, fontFamily: font.semibold, color: colors.gray[600], flex: 1 },

  adminBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: radius.md, backgroundColor: colors.adminSoft, marginTop: spacing.sm },
  adminBtnPrimary: { backgroundColor: colors.primarySoft },
  adminBtnText: { fontFamily: font.bold, fontSize: 13 },

  submitBtn: { marginTop: spacing.lg, borderRadius: radius.lg, overflow: 'hidden', ...shadow.colored(colors.primary) },
  submitGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingVertical: 18 },
  submitText: { color: colors.white, fontFamily: font.black, letterSpacing: 2, fontSize: 14 },

  successCard: { marginTop: spacing.lg, padding: spacing.xxl, backgroundColor: colors.successSoft, borderRadius: radius.lg, alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  successTitle: { fontSize: 17, fontFamily: font.black, color: colors.success },

  modalBg: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: colors.white, borderRadius: radius.xl, padding: spacing.xl, maxHeight: '85%', ...shadow.lg },
  modalTitle: { fontSize: 18, fontFamily: font.black, color: colors.gray[900], marginBottom: spacing.lg },
  pickerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderRadius: radius.md, backgroundColor: colors.gray[50], marginBottom: 6 },
  pickerRowActive: { backgroundColor: colors.primarySoft },
  pickerText: { fontSize: 15, fontFamily: font.semibold, color: colors.gray[700] },
  modalClose: { marginTop: spacing.md, paddingVertical: 14, backgroundColor: colors.gray[100], borderRadius: radius.md, alignItems: 'center' },
  modalCloseText: { color: colors.gray[600], fontFamily: font.bold },
});
