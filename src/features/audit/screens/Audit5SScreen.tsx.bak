import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ScrollView, Alert, ActivityIndicator, RefreshControl,
  Modal, Image,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useAuth } from '../../auth/AuthProvider';
import { SECTIONS_5S, ALL_QUESTIONS_5S, Audit5SQuestion } from '../questions5s';
import { LIGNES } from '../lignes';
import {
  getOrCreateDraftAudit, getMyCompanyId, getMyRole,
  getAuditAnswers, answerQuestion, submitAudit,
  updateAuditHeader, AnswerRow, AuditMeta, Role,
} from '../auditService';
import { uploadAuditImage } from '../../../lib/imageUpload';
import AuditeurPickerModal from '../components/AuditeurPickerModal';

type AnswerValue = 'ok' | 'nok' | 'na';

export default function Audit5SScreen() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('member');
  const [audit, setAudit] = useState<AuditMeta | null>(null);
  const [answers, setAnswers] = useState<Record<string, AnswerRow>>({});
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
      const r = await getMyRole(cid);
      setRole(r);
      const a = await getOrCreateDraftAudit(cid, '5s');
      setAudit(a);
      const rows = await getAuditAnswers(a.id);
      const map: Record<string, AnswerRow> = {};
      rows.forEach((row) => (map[row.question_id] = row));
      setAnswers(map);
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);
  useFocusEffect(useCallback(() => { (async () => { if (companyId) await load(); })(); }, [companyId, load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  /* Admin : zone */
  const setZone = async (z: string) => {
    if (!audit) return;
    setZoneModal(false);
    try {
      await updateAuditHeader(audit.id, { zone: z });
      setAudit({ ...audit, zone: z });
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  };

  /* Auditeur : pilote de la zone */
  const savePilote = async () => {
    if (!audit) return;
    setPiloteModal(false);
    try {
      await updateAuditHeader(audit.id, { pilote_zone: tmpPilote.trim() || null });
      setAudit({ ...audit, pilote_zone: tmpPilote.trim() || null });
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  };

  /* Admin : auditeur */
  const setAuditeur = async (id: string) => {
    if (!audit) return;
    try {
      await updateAuditHeader(audit.id, { auditeur_id: id });
      setAudit({ ...audit, auditeur_id: id });
    } catch (e: any) { Alert.alert('Erreur', e.message); }
  };

  const myProgress = useMemo(() => {
    const total = ALL_QUESTIONS_5S.length;
    const done = ALL_QUESTIONS_5S.filter((q) => answers[q.label]?.status === 'done').length;
    return { total, done, pct: total ? done / total : 0 };
  }, [answers]);

  const patchRow = (q: Audit5SQuestion, patch: Partial<AnswerRow>) => {
    setAnswers((s) => ({
      ...s,
      [q.label]: {
        ...(s[q.label] ?? ({
          id: '', audit_id: audit?.id ?? '', question_id: q.label,
          category: `${q.step} — ${q.title}`,
          assignee_id: user?.id ?? null,
          due_date: null, pilot: null, answer: null, comment: '',
          status: 'planned', image_url: null,
        } as AnswerRow)),
        ...patch,
      } as AnswerRow,
    }));
  };

  const setAnswer = (q: Audit5SQuestion, v: AnswerValue) => {
    Haptics.selectionAsync();
    setErrors((e) => ({ ...e, [q.label]: '' }));
    patchRow(q, { answer: v, status: 'done' });
  };
  const setComment = (q: Audit5SQuestion, t: string) => { setErrors((e) => ({ ...e, [q.label]: '' })); patchRow(q, { comment: t }); };
  const setPilotQ = (q: Audit5SQuestion, t: string) => { setErrors((e) => ({ ...e, [q.label]: '' })); patchRow(q, { pilot: t }); };
  const setDueDate = (q: Audit5SQuestion, t: string) => { setErrors((e) => ({ ...e, [q.label]: '' })); patchRow(q, { due_date: t }); };

  const pickAndUploadImage = async (q: Audit5SQuestion) => {
    if (!audit || !user?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission requise', 'Autorisez les photos.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, quality: 0.75 });
    if (res.canceled || !res.assets[0]) return;
    setUploadingFor(q.label);
    try {
      const url = await uploadAuditImage(user.id, audit.id, q.label, res.assets[0].uri);
      patchRow(q, { image_url: url });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) { Alert.alert('Upload échoué', e.message); }
    finally { setUploadingFor(null); }
  };

  const removeImage = (q: Audit5SQuestion) => patchRow(q, { image_url: null });

  const saveRow = async (q: Audit5SQuestion) => {
    if (!audit) return;
    const row = answers[q.label];
    if (!row?.answer) return;
    if (row.answer === 'nok') {
      const problems: string[] = [];
      if (!(row.comment ?? '').trim()) problems.push('commentaire');
      if (!(row.pilot ?? '').trim()) problems.push('pilote');
      if (!(row.due_date ?? '').trim()) problems.push('date prévue');
      if (!row.image_url) problems.push('image');
      if (problems.length > 0) {
        setErrors((e) => ({ ...e, [q.label]: `Requis pour NOK : ${problems.join(', ')}` }));
        return;
      }
    }
    try {
      await answerQuestion({
        auditId: audit.id, questionId: q.label,
        category: `${q.step} — ${q.title}`,
        answer: row.answer, comment: row.comment ?? '',
        imageUrl: row.image_url,
      });
    } catch (e: any) { console.warn(e); }
  };

  const handleSubmit = async () => {
    if (!audit) return;
    if (!audit.pilote_zone) {
      Alert.alert('Pilote requis', 'Renseignez le pilote de la zone.');
      return;
    }
    const problems: Record<string, string> = {};
    for (const q of ALL_QUESTIONS_5S) {
      const row = answers[q.label];
      if (!row?.answer) { problems[q.label] = 'Réponse requise'; continue; }
      if (row.answer === 'nok') {
        const miss: string[] = [];
        if (!(row.comment ?? '').trim()) miss.push('commentaire');
        if (!(row.pilot ?? '').trim()) miss.push('pilote');
        if (!(row.due_date ?? '').trim()) miss.push('date prévue');
        if (!row.image_url) miss.push('image');
        if (miss.length > 0) problems[q.label] = `Requis pour NOK : ${miss.join(', ')}`;
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
      for (const q of ALL_QUESTIONS_5S) await saveRow(q);
      await submitAudit(audit.id, 100);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      Alert.alert('Merci !', 'Vos réponses ont été enregistrées.', [
        { text: 'OK', onPress: () => router.replace('/(app)') },
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Réessayez.');
    } finally { setSubmitBusy(false); }
  };

  if (loading) return (<View style={styles.center}><ActivityIndicator color="#2563EB" size="large" /></View>);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Audit 5S</Text>
            <Text style={styles.headerSub}>
              {isAdmin ? 'Mode administrateur' : (isAuditeur ? 'Auditeur' : 'Observateur')}
            </Text>
          </View>
          <View style={[styles.rolePill, isAdmin ? styles.rolePillAdmin : styles.rolePillMember]}>
            <Text style={styles.rolePillText}>{isAdmin ? 'ADMIN' : (isAuditeur ? 'AUDITEUR' : '—')}</Text>
          </View>
        </View>

        {/* Zone (admin) + Pilote (auditeur) */}
        <View style={styles.metaBand}>
          <TouchableOpacity style={styles.metaCell}
            onPress={() => isAdmin && setZoneModal(true)}
            disabled={!isAdmin}>
            <Text style={styles.metaCellLabel}>ZONE</Text>
            <Text style={[styles.metaCellValue, !audit?.zone && { color: '#EF4444' }]}>
              {audit?.zone || (isAdmin ? 'Choisir…' : '—')}
            </Text>
          </TouchableOpacity>
          <View style={styles.metaSep} />
          <TouchableOpacity style={styles.metaCell}
            onPress={() => { if (canAnswer) { setTmpPilote(audit?.pilote_zone ?? ''); setPiloteModal(true); } }}
            disabled={!canAnswer}>
            <Text style={styles.metaCellLabel}>PILOTE ZONE</Text>
            <Text style={[styles.metaCellValue, canAnswer && !audit?.pilote_zone && { color: '#EF4444' }]}>
              {audit?.pilote_zone || (canAnswer ? 'Saisir…' : '—')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Auditeur (admin) */}
        <TouchableOpacity
          style={styles.auditeurBand}
          onPress={() => isAdmin && setAuditeurModal(true)}
          disabled={!isAdmin}
        >
          <Text style={styles.metaCellLabel}>AUDITEUR</Text>
          <Text style={[styles.metaCellValue, !audit?.auditeur_id && { color: '#EF4444' }]}>
            {audit?.auditeur_id
              ? (audit.auditeur_id === user?.id ? 'Vous-même' : 'Assigné')
              : (isAdmin ? 'Choisir…' : 'Non assigné')}
          </Text>
        </TouchableOpacity>

        {canAnswer && (
          <>
            <Text style={styles.headerStat}>{myProgress.done} / {myProgress.total} répondues</Text>
            <View style={styles.progressTrack}>
              <LinearGradient colors={['#3B82F6', '#06B6D4']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                style={[styles.progressFill, { width: `${myProgress.pct * 100}%` }]} />
            </View>
          </>
        )}
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>

        {!canAnswer && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>⏳</Text>
            <Text style={styles.emptyTitle}>
              {isAdmin ? 'Assignez un auditeur' : "En attente d'affectation"}
            </Text>
            <Text style={styles.emptyText}>
              {isAdmin
                ? "Touchez le bandeau violet pour désigner l'auditeur."
                : "L'administrateur doit vous désigner comme auditeur."}
            </Text>
          </View>
        )}

        {canAnswer && SECTIONS_5S.map((section) => (
          <View key={section.step} style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{section.step}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionSubtitle}>{section.subtitle}</Text>
              </View>
            </View>

            {section.questions.map((q) => {
              const row = answers[q.label];
              const err = errors[q.label];
              const isNok = row?.answer === 'nok';
              return (
                <Animated.View key={q.label} entering={FadeInDown.duration(400)} style={styles.card}>
                  <View style={styles.qChip}><Text style={styles.qChipText}>{q.label}</Text></View>
                  <Text style={styles.qTitle}>{q.text}</Text>

                  <View style={styles.seg}>
                    {(['ok', 'nok', 'na'] as AnswerValue[]).map((val) => {
                      const active = row?.answer === val;
                      const color = val === 'ok' ? '#10B981' : val === 'nok' ? '#EF4444' : '#94A3B8';
                      return (
                        <TouchableOpacity key={val} onPress={() => setAnswer(q, val)}
                          style={[styles.segBtn, active && { backgroundColor: color + '20', borderColor: color }]}>
                          <Text style={[styles.segText, active && { color, fontWeight: '900' }]}>
                            {val === 'na' ? 'N/A' : val.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.sectionLabel}>COMMENTAIRE{isNok && <Text style={styles.requiredTag}> — OBLIGATOIRE</Text>}</Text>
                  <TextInput placeholder={isNok ? 'Expliquez le problème…' : 'Commentaire (optionnel)'}
                    value={row?.comment ?? ''} onChangeText={(t) => setComment(q, t)}
                    onBlur={() => saveRow(q)} multiline
                    style={[styles.commentInput, isNok && !(row?.comment ?? '').trim() && err ? { borderColor: '#EF4444', borderWidth: 1.5 } : null]}
                    placeholderTextColor="#94A3B8" />

                  <Text style={styles.sectionLabel}>PILOTE{isNok && <Text style={styles.requiredTag}> — OBLIGATOIRE</Text>}</Text>
                  <TextInput placeholder="Nom du pilote" value={row?.pilot ?? ''} onChangeText={(t) => setPilotQ(q, t)} onBlur={() => saveRow(q)}
                    style={[styles.lineInput, isNok && !(row?.pilot ?? '').trim() && err ? { borderColor: '#EF4444', borderWidth: 1.5 } : null]}
                    placeholderTextColor="#94A3B8" />

                  <Text style={styles.sectionLabel}>DATE PRÉVUE{isNok && <Text style={styles.requiredTag}> — OBLIGATOIRE</Text>}</Text>
                  <TextInput placeholder="AAAA-MM-JJ" value={row?.due_date ?? ''} onChangeText={(t) => setDueDate(q, t)} onBlur={() => saveRow(q)}
                    style={[styles.lineInput, isNok && !(row?.due_date ?? '').trim() && err ? { borderColor: '#EF4444', borderWidth: 1.5 } : null]}
                    placeholderTextColor="#94A3B8" />

                  {isNok && (
                    <>
                      <Text style={styles.sectionLabel}>PHOTO<Text style={styles.requiredTag}> — OBLIGATOIRE POUR NOK</Text></Text>
                      {row?.image_url ? (
                        <View style={styles.imageBox}>
                          <Image source={{ uri: row.image_url }} style={styles.image} />
                          <View style={styles.imageActions}>
                            <TouchableOpacity style={styles.imageBtn} onPress={() => pickAndUploadImage(q)}>
                              <Text style={styles.imageBtnText}>Remplacer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.imageBtn, { backgroundColor: 'rgba(239,68,68,0.1)' }]} onPress={() => removeImage(q)}>
                              <Text style={[styles.imageBtnText, { color: '#DC2626' }]}>Supprimer</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.uploadBtn} onPress={() => pickAndUploadImage(q)} disabled={uploadingFor === q.label}>
                          {uploadingFor === q.label ? <ActivityIndicator color="#2563EB" /> : <Text style={styles.uploadBtnText}>📷 Ajouter une photo</Text>}
                        </TouchableOpacity>
                      )}
                    </>
                  )}

                  {err ? <Text style={styles.errorText}>{err}</Text> : null}
                </Animated.View>
              );
            })}
          </View>
        ))}

        {canAnswer && !submitted && (
          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit} disabled={submitBusy}>
            <LinearGradient colors={['#3B82F6', '#2563EB', '#1E40AF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.submitGrad}>
              {submitBusy ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>SOUMETTRE MES RÉPONSES</Text>}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {submitted && (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Audit 5S soumis</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Zone modal (admin) */}
      <Modal visible={zoneModal} transparent animationType="fade" onRequestClose={() => setZoneModal(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Choisir une zone</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {LIGNES.map((l) => {
                const active = audit?.zone === l;
                return (
                  <TouchableOpacity key={l} style={[styles.pickerRow, active && styles.pickerRowActive]} onPress={() => setZone(l)}>
                    <Text style={[styles.pickerText, active && styles.pickerTextActive]}>{l}</Text>
                    {active && <Text style={styles.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity style={styles.pickerClose} onPress={() => setZoneModal(false)}>
              <Text style={styles.pickerCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Pilote modal (auditeur) */}
      <Modal visible={piloteModal} transparent animationType="fade" onRequestClose={() => setPiloteModal(false)}>
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Pilote de la zone</Text>
            <TextInput value={tmpPilote} onChangeText={setTmpPilote} placeholder="Nom du pilote"
              placeholderTextColor="#94A3B8" style={styles.pickerInput} autoFocus />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 14 }}>
              <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => setPiloteModal(false)}>
                <Text style={{ color: '#475569', fontWeight: '800' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pickerBtn, { backgroundColor: '#2563EB' }]} onPress={savePilote}>
                <Text style={{ color: '#FFF', fontWeight: '800' }}>Enregistrer</Text>
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
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  headerSub: { fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 2 },
  headerStat: { fontSize: 13, color: '#64748B', fontWeight: '700', marginTop: 12 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rolePillAdmin: { backgroundColor: 'rgba(124,58,237,0.15)' },
  rolePillMember: { backgroundColor: 'rgba(37,99,235,0.15)' },
  rolePillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#1E293B' },
  metaBand: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, marginTop: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  metaCell: { flex: 1, paddingHorizontal: 8 },
  metaCellLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5 },
  metaCellValue: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginTop: 4 },
  metaSep: { width: 1, backgroundColor: '#E2E8F0' },
  auditeurBand: { backgroundColor: 'rgba(124,58,237,0.06)', borderRadius: 12, padding: 12, marginTop: 8, borderWidth: 1, borderColor: 'rgba(124,58,237,0.25)' },
  progressTrack: { height: 6, backgroundColor: '#E2E8F0', borderRadius: 3, marginTop: 10, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  scroll: { padding: 16, paddingBottom: 80 },
  empty: { alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 6 },
  sectionBlock: { marginBottom: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  sectionBadge: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  sectionBadgeText: { color: '#FFF', fontWeight: '900', fontSize: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  sectionSubtitle: { fontSize: 12, color: '#64748B', fontStyle: 'italic', marginTop: 2 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  qChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(37,99,235,0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  qChipText: { fontSize: 12, fontWeight: '900', color: '#2563EB', letterSpacing: 1 },
  qTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A', lineHeight: 20, marginBottom: 10 },
  sectionLabel: { fontSize: 11, fontWeight: '900', color: '#64748B', letterSpacing: 1.5, marginTop: 14, marginBottom: 6 },
  requiredTag: { color: '#EF4444', fontWeight: '900' },
  seg: { flexDirection: 'row', gap: 8, marginTop: 4 },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', alignItems: 'center', backgroundColor: '#F8FAFC' },
  segText: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: '#94A3B8' },
  commentInput: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0F172A', minHeight: 55, textAlignVertical: 'top' },
  lineInput: { borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13, color: '#0F172A' },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '700', marginTop: 6 },
  uploadBtn: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#CBD5E1', borderRadius: 12, paddingVertical: 20, alignItems: 'center', backgroundColor: '#F8FAFC' },
  uploadBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 14 },
  imageBox: { marginTop: 4 },
  image: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F1F5F9' },
  imageActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  imageBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center' },
  imageBtnText: { fontWeight: '800', fontSize: 12, color: '#334155' },
  submitBtn: { marginTop: 12, borderRadius: 16, overflow: 'hidden' },
  submitGrad: { paddingVertical: 18, alignItems: 'center' },
  submitText: { color: '#FFF', fontWeight: '900', letterSpacing: 2, fontSize: 14 },
  successCard: { marginTop: 16, padding: 24, backgroundColor: 'rgba(16,185,129,0.08)', borderWidth: 1, borderColor: 'rgba(16,185,129,0.3)', borderRadius: 16, alignItems: 'center' },
  successIcon: { fontSize: 40, marginBottom: 8 },
  successTitle: { fontSize: 18, fontWeight: '900', color: '#059669' },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  pickerCard: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 20, maxHeight: '85%' },
  pickerTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 14 },
  pickerRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 10, backgroundColor: '#F8FAFC', marginBottom: 6 },
  pickerRowActive: { backgroundColor: 'rgba(37,99,235,0.12)' },
  pickerText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#334155' },
  pickerTextActive: { color: '#2563EB' },
  pickerCheck: { fontSize: 16, fontWeight: '900', color: '#2563EB' },
  pickerClose: { marginTop: 12, paddingVertical: 12, backgroundColor: '#F1F5F9', borderRadius: 10, alignItems: 'center' },
  pickerCloseText: { color: '#475569', fontWeight: '800' },
  pickerInput: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A' },
  pickerBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
