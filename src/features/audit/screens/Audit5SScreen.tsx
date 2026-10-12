import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
  ActivityIndicator, RefreshControl, Modal, TextInput,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../../auth/AuthProvider';
import {
  SECTIONS_5S as DEFAULT_SECTIONS,
  ALL_QUESTIONS_5S as DEFAULT_ALL,
  Audit5SQuestion, Audit5SSection,
} from '../questions5s';
import { getEffective5S, listLignes } from '../contentService';
import {
  getOrCreateDraftAudit, getMyCompanyId, getMyRole,
  getAuditAnswers, answerQuestion, submitAudit,
  updateAuditHeader, computeScore, saveAuditScore,
  AnswerRow, AuditMeta, Role,
} from '../auditService';
import { uploadAuditImage } from '../../../lib/imageUpload';
import AuditeurPickerModal from '../components/AuditeurPickerModal';
import QuestionCard from '../../../components/QuestionCard';
import { colors, font, radius, shadow, spacing } from '../../../theme';

type AnswerValue = 'ok' | 'nok' | 'na';

export default function Audit5SScreen() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('member');
  const [audit, setAudit] = useState<AuditMeta | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerRow>>({});
  const [sections5S, setSections5S] = useState<Audit5SSection[]>(DEFAULT_SECTIONS);
  const [all5S, setAll5S] = useState<Audit5SQuestion[]>(DEFAULT_ALL);
  const [lignesList, setLignesList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [submitBusy, setSubmitBusy] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [zoneModal, setZoneModal] = useState(false);
  const [piloteModal, setPiloteModal] = useState(false);
  const [auditeurModal, setAuditeurModal] = useState(false);
  const [tmpPilote, setTmpPilote] = useState('');

  const isAdmin = role === 'owner' || role === 'admin';
  const isAuditeur = !!user?.id && audit?.auditeur_id === user.id;
  const canAnswer = isAuditeur;

  const load = useCallback(async () => {
    try {
      const cid = await getMyCompanyId();
      setCompanyId(cid);
      if (!cid) return;
      setRole(await getMyRole(cid));
      const a = await getOrCreateDraftAudit(cid, '5s');
      setAudit(a);
      const [rows, sR, lR] = await Promise.all([
        getAuditAnswers(a.id), getEffective5S(cid), listLignes(cid),
      ]);
      const secs = sR?.sections?.length ? sR.sections : DEFAULT_SECTIONS;
      setSections5S(secs);
      setAll5S(secs.flatMap((s) => s.questions ?? []));
      setLignesList(Array.isArray(lR) ? lR : []);
      const map: Record<string, AnswerRow> = {};
      rows.forEach((r) => (map[r.question_id] = r));
      setAnswers(map);
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);
  useFocusEffect(useCallback(() => { (async () => { if (companyId) await load(); })(); }, [companyId, load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const myProgress = useMemo(() => {
    const total = all5S.length;
    const done = all5S.filter((q) => answers[q.label]?.status === 'done').length;
    return { total, done, pct: total ? done / total : 0 };
  }, [all5S, answers]);

  const setZone = async (z: string) => {
    if (!audit) return;
    setZoneModal(false);
    try {
      await updateAuditHeader(audit.id, { zone: z });
      setAudit({ ...audit, zone: z });
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  };
  const setAuditeur = async (id: string) => {
    if (!audit) return;
    try {
      await updateAuditHeader(audit.id, { auditeur_id: id });
      setAudit({ ...audit, auditeur_id: id });
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  };
  const savePilote = async () => {
    if (!audit) return;
    setPiloteModal(false);
    try {
      await updateAuditHeader(audit.id, { pilote_zone: tmpPilote.trim() || null });
      setAudit({ ...audit, pilote_zone: tmpPilote.trim() || null });
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  };

  const patch = (q: Audit5SQuestion, p: Partial<AnswerRow>) => {
    setAnswers((s) => ({
      ...s, [q.label]: {
        ...(s[q.label] ?? {
          id: '', audit_id: audit?.id ?? '', question_id: q.label,
          category: q.step + ' — ' + q.title, assignee_id: user?.id ?? null,
          due_date: null, pilot: null, answer: null, comment: '',
          status: 'planned', image_url: null,
        } as AnswerRow),
        ...p,
      } as AnswerRow,
    }));
  };

  const onAnswer = (q: Audit5SQuestion, v: AnswerValue) => { setErrors((e) => ({ ...e, [q.label]: '' })); patch(q, { answer: v, status: 'done' }); };
  const onComment = (q: Audit5SQuestion, t: string) => { setErrors((e) => ({ ...e, [q.label]: '' })); patch(q, { comment: t }); };
  const onPilot = (q: Audit5SQuestion, t: string) => { setErrors((e) => ({ ...e, [q.label]: '' })); patch(q, { pilot: t }); };
  const onDate = (q: Audit5SQuestion, t: string) => { setErrors((e) => ({ ...e, [q.label]: '' })); patch(q, { due_date: t }); };

  const pickImage = async (q: Audit5SQuestion) => {
    if (!audit || !user?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', 'Autorisez les photos.'); return; }
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.75 });
    if (r.canceled || !r.assets[0]) return;
    setUploadingFor(q.label);
    try {
      const url = await uploadAuditImage(user.id, audit.id, q.label, r.assets[0].uri);
      patch(q, { image_url: url });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert('Upload échoué', e.message); }
    finally { setUploadingFor(null); }
  };

  const saveRow = async (q: Audit5SQuestion) => {
    if (!audit) return;
    const row = answers[q.label];
    if (!row?.answer) return;
    if (row.answer === 'nok') {
      const miss: string[] = [];
      if (!(row.comment ?? '').trim()) miss.push('commentaire');
      if (!(row.pilot ?? '').trim()) miss.push('pilote');
      if (!(row.due_date ?? '').trim()) miss.push('date');
      if (!row.image_url) miss.push('image');
      if (miss.length) { setErrors((e) => ({ ...e, [q.label]: `Requis : ${miss.join(', ')}` })); return; }
    }
    try {
      await answerQuestion({
        auditId: audit.id, questionId: q.label,
        category: q.step + ' — ' + q.title,
        answer: row.answer, comment: row.comment ?? '', imageUrl: row.image_url,
      });
    } catch (e) { console.warn(e); }
  };

  const handleSubmit = async () => {
    if (!audit) return;
    if (!audit.pilote_zone) { Alert.alert('Pilote requis', 'Renseignez le pilote de la zone.'); return; }
    const problems: Record<string, string> = {};
    for (const q of all5S) {
      const row = answers[q.label];
      if (!row?.answer) { problems[q.label] = 'Réponse requise'; continue; }
      if (row.answer === 'nok') {
        const miss: string[] = [];
        if (!(row.comment ?? '').trim()) miss.push('commentaire');
        if (!(row.pilot ?? '').trim()) miss.push('pilote');
        if (!(row.due_date ?? '').trim()) miss.push('date');
        if (!row.image_url) miss.push('image');
        if (miss.length) problems[q.label] = `Requis : ${miss.join(', ')}`;
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
      for (const q of all5S) await saveRow(q);
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
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Audit 5S</Text>
            <Text style={styles.headerSub}>
              {isAdmin ? 'Mode administrateur' : isAuditeur ? 'Auditeur' : 'Observateur'}
            </Text>
          </View>
          <View style={[styles.rolePill, isAdmin ? styles.roleAdmin : styles.roleMember]}>
            <Text style={styles.roleText}>{isAdmin ? 'ADMIN' : isAuditeur ? 'AUDITEUR' : '—'}</Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <TouchableOpacity style={styles.metaCell} onPress={() => isAdmin && setZoneModal(true)} disabled={!isAdmin}>
            <Feather name="map" size={14} color={colors.primary} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.metaLabel}>ZONE</Text>
              <Text style={[styles.metaValue, !audit?.zone && isAdmin && { color: colors.danger }]}>
                {audit?.zone || (isAdmin ? 'Choisir' : '—')}
              </Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.metaCell}
            onPress={() => { if (canAnswer) { setTmpPilote(audit?.pilote_zone ?? ''); setPiloteModal(true); } }}
            disabled={!canAnswer}
          >
            <Feather name="user" size={14} color={colors.admin} />
            <View style={{ marginLeft: 8 }}>
              <Text style={styles.metaLabel}>PILOTE</Text>
              <Text style={[styles.metaValue, canAnswer && !audit?.pilote_zone && { color: colors.danger }]}>
                {audit?.pilote_zone || (canAnswer ? 'Saisir' : '—')}
              </Text>
            </View>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.auditeurBand} onPress={() => isAdmin && setAuditeurModal(true)} disabled={!isAdmin}>
          <Feather name="user-check" size={18} color={colors.admin} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.metaLabel}>AUDITEUR</Text>
            <Text style={[styles.metaValue, !audit?.auditeur_id && { color: colors.danger }]}>
              {audit?.auditeur_id
                ? (audit.auditeur_id === user?.id ? 'Vous-même' : 'Assigné')
                : (isAdmin ? 'Choisir un auditeur' : 'Non assigné')}
            </Text>
          </View>
          {isAdmin && <Feather name="chevron-right" size={20} color={colors.gray[400]} />}
        </TouchableOpacity>

        {canAnswer && (
          <View style={styles.progressWrap}>
            <View style={styles.progressHead}>
              <Text style={styles.progressLabel}>Progression</Text>
              <Text style={styles.progressValue}>{myProgress.done} / {myProgress.total}</Text>
            </View>
            <View style={styles.progressTrack}>
              <LinearGradient colors={[colors.primary, '#06B6D4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${myProgress.pct * 100}%` }]} />
            </View>
          </View>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {!canAnswer && (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Feather name="clock" size={36} color={colors.gray[400]} /></View>
            <Text style={styles.emptyTitle}>
              {isAdmin ? 'Assignez un auditeur' : "En attente d'affectation"}
            </Text>
            <Text style={styles.emptyText}>
              {isAdmin ? "Touchez le bandeau violet pour désigner l'auditeur." : "L'administrateur doit vous désigner comme auditeur."}
            </Text>
          </View>
        )}

        {canAnswer && (sections5S ?? DEFAULT_SECTIONS).map((section) => (
          <View key={section.step} style={styles.sectionBlock}>
            <View style={styles.sectionHead}>
              <LinearGradient
                colors={[colors.gray[900], colors.gray[700]]}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={styles.sectionBadge}
              >
                <Text style={styles.sectionBadgeText}>{section.step}</Text>
              </LinearGradient>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>
            </View>

            {(section.questions ?? []).map((q, qi) => {
              const row = answers[q.label];
              return (
                <QuestionCard
                  key={q.label}
                  index={qi}
                  total={section.questions.length}
                  category={q.label}
                  title={q.text}
                  criteria={[]}
                  answer={row?.answer ?? null}
                  comment={row?.comment ?? ''}
                  pilot={row?.pilot ?? ''}
                  dueDate={row?.due_date ?? ''}
                  imageUrl={row?.image_url}
                  error={errors[q.label]}
                  uploading={uploadingFor === q.label}
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
          </View>
        ))}

        {canAnswer && !submitted && (
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitBusy} activeOpacity={0.9}>
            <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitGrad}>
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
            <Text style={styles.successTitle}>Audit 5S soumis</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      <Modal visible={zoneModal} transparent animationType="fade" onRequestClose={() => setZoneModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Choisir une zone</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {lignesList.map((l) => {
                const active = audit?.zone === l;
                return (
                  <TouchableOpacity key={l} style={[styles.pickerRow, active && styles.pickerRowActive]} onPress={() => setZone(l)}>
                    <Text style={[styles.pickerText, active && { color: colors.primary, fontFamily: font.bold }]}>{l}</Text>
                    {active && <Feather name="check" size={18} color={colors.primary} />}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.modalClose} onPress={() => setZoneModal(false)}>
              <Text style={styles.modalCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={piloteModal} transparent animationType="fade" onRequestClose={() => setPiloteModal(false)}>
        <View style={styles.modalBg}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Pilote de la zone</Text>
            <TextInput
              value={tmpPilote}
              onChangeText={setTmpPilote}
              placeholder="Nom du pilote"
              placeholderTextColor={colors.gray[400]}
              style={styles.input}
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: spacing.lg }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.gray[100] }]} onPress={() => setPiloteModal(false)}>
                <Text style={{ color: colors.gray[600], fontFamily: font.bold }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: colors.primary }]} onPress={savePilote}>
                <Text style={{ color: colors.white, fontFamily: font.bold }}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AuditeurPickerModal
        visible={auditeurModal}
        companyId={companyId}
        currentAuditeurId={audit?.auditeur_id ?? null}
        onClose={() => setAuditeurModal(false)}
        onConfirm={setAuditeur}
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

  metaRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg },
  metaCell: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.gray[50], borderRadius: radius.md, padding: spacing.md, borderWidth: 1, borderColor: colors.gray[200] },
  metaLabel: { fontSize: 10, fontFamily: font.extrabold, color: colors.gray[500], letterSpacing: 1.5 },
  metaValue: { fontSize: 14, fontFamily: font.black, color: colors.gray[900], marginTop: 2 },

  auditeurBand: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.adminSoft, borderRadius: radius.md, padding: spacing.md, marginTop: spacing.md, borderWidth: 1, borderColor: '#DDD6FE' },

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

  sectionBlock: { marginBottom: spacing.xl },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  sectionBadge: { width: 44, height: 44, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', marginRight: spacing.md, ...shadow.sm },
  sectionBadgeText: { color: colors.white, fontFamily: font.black, fontSize: 16, letterSpacing: 1 },
  sectionTitle: { fontSize: 17, fontFamily: font.black, color: colors.gray[900] },
  sectionSubtitle: { fontSize: 11, fontFamily: font.semibold, color: colors.gray[400], marginTop: 2, letterSpacing: 0.3 },

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
  input: { borderWidth: 1.5, borderColor: colors.gray[200], backgroundColor: colors.gray[50], borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 14, fontSize: 15, fontFamily: font.medium, color: colors.gray[900] },
  modalBtn: { flex: 1, paddingVertical: 14, borderRadius: radius.md, alignItems: 'center' },
});
