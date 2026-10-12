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
import { AuditQuestion } from '../questions';
import { getEffectiveGemba, listLignes } from '../contentService';
import {
  getOrCreateDraftAudit, getMyCompanyId, getMyRole,
  getAuditAnswers, answerQuestion, submitAudit,
  computeScore, saveAuditScore,
  updateAuditHeader, planQuestion, AnswerRow, AuditMeta, Role,
} from '../auditService';
import { uploadAuditImage } from '../../../lib/imageUpload';
import PlanningModal, { PlanningPayload } from '../components/PlanningModal';

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

  /* ─────── Load ─────── */

  const load = useCallback(async () => {
    try {
      const cid = await getMyCompanyId();
      setCompanyId(cid);
      if (!cid) return;
      const r = await getMyRole(cid);
      setRole(r);
      const a = await getOrCreateDraftAudit(cid, 'gemba');
      setAudit(a);
      const [rows, qResult, lResult] = await Promise.all([
        getAuditAnswers(a.id),
        getEffectiveGemba(cid),
        listLignes(cid),
      ]);
      setGembaQuestions(qResult.questions);
      setLignesList(lResult);
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

  /* ─────── Admin : changer la ligne ─────── */

  const setLigne = async (l: string) => {
    if (!audit) return;
    setLigneModal(false);
    try {
      await updateAuditHeader(audit.id, { ligne: l });
      setAudit({ ...audit, ligne: l });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    }
  };

  /* ─────── Admin : assigner une question à un user ─────── */

  const openPlanning = (q: AuditQuestion) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setPlanningFor(q);
  };

  const confirmPlanning = async (payload: PlanningPayload) => {
    if (!planningFor || !audit) return;
    const q = planningFor;
    try {
      await planQuestion({
        auditId: audit.id,
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
          audit_id: audit.id,
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

  /* ─────── Filtres ─────── */

  /* Admin voit les 10 questions, l'auditeur voit uniquement ses assignées */
  const myAssignedQuestions = useMemo(() => {
    if (isAdmin || !user?.id) return [];
    return gembaQuestions.filter((q) => answers[q.id]?.assignee_id === user.id);
  }, [answers, isAdmin, user?.id, gembaQuestions]);

  const visibleQuestions = isAdmin ? gembaQuestions : myAssignedQuestions;

  const progress = useMemo(() => {
    const total = gembaQuestions.length;
    const assigned = gembaQuestions.filter((q) => answers[q.id]?.assignee_id).length;
    const done = gembaQuestions.filter((q) => answers[q.id]?.status === 'done').length;
    return { total, assigned, done };
  }, [answers, gembaQuestions]);

  const myProgress = useMemo(() => {
    const total = myAssignedQuestions.length;
    const done = myAssignedQuestions.filter(
      (q) => answers[q.id]?.status === 'done'
    ).length;
    return { total, done, pct: total ? done / total : 0 };
  }, [myAssignedQuestions, answers]);

  /* ─────── Answer handlers ─────── */

  const patchRow = (q: AuditQuestion, patch: Partial<AnswerRow>) => {
    setAnswers((s) => ({
      ...s,
      [q.id]: {
        ...(s[q.id] ??
          ({
            id: '',
            audit_id: audit?.id ?? '',
            question_id: q.id,
            category: q.category,
            assignee_id: user?.id ?? null,
            due_date: null,
            pilot: null,
            answer: null,
            comment: '',
            status: 'planned',
            image_url: null,
          } as AnswerRow)),
        ...patch,
      } as AnswerRow,
    }));
  };

  const setAnswer = (q: AuditQuestion, v: AnswerValue) => {
    Haptics.selectionAsync();
    setErrors((e) => ({ ...e, [q.id]: '' }));
    patchRow(q, { answer: v, status: 'done' });
  };
  const setComment = (q: AuditQuestion, t: string) => {
    setErrors((e) => ({ ...e, [q.id]: '' }));
    patchRow(q, { comment: t });
  };
  const setPilotQ = (q: AuditQuestion, t: string) => {
    setErrors((e) => ({ ...e, [q.id]: '' }));
    patchRow(q, { pilot: t });
  };
  const setDueDate = (q: AuditQuestion, t: string) => {
    setErrors((e) => ({ ...e, [q.id]: '' }));
    patchRow(q, { due_date: t });
  };

  /* ─────── Image upload ─────── */

  const pickAndUploadImage = async (q: AuditQuestion) => {
    if (!audit || !user?.id) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorisez les photos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.75,
    });
    if (res.canceled || !res.assets[0]) return;
    setUploadingFor(q.id);
    try {
      const url = await uploadAuditImage(user.id, audit.id, q.id, res.assets[0].uri);
      patchRow(q, { image_url: url });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Upload échoué', e.message);
    } finally {
      setUploadingFor(null);
    }
  };

  const removeImage = (q: AuditQuestion) => patchRow(q, { image_url: null });

  /* ─────── Save one row ─────── */

  const saveRow = async (q: AuditQuestion) => {
    if (!audit) return;
    const row = answers[q.id];
    if (!row?.answer) return;
    if (row.answer === 'nok') {
      const problems: string[] = [];
      if (!(row.comment ?? '').trim()) problems.push('commentaire');
      if (!(row.pilot ?? '').trim()) problems.push('pilote');
      if (!(row.due_date ?? '').trim()) problems.push('date prévue');
      if (!row.image_url) problems.push('image');
      if (problems.length > 0) {
        setErrors((e) => ({
          ...e,
          [q.id]: `Requis pour NOK : ${problems.join(', ')}`,
        }));
        return;
      }
    }
    try {
      await answerQuestion({
        auditId: audit.id,
        questionId: q.id,
        category: q.category,
        answer: row.answer,
        comment: row.comment ?? '',
        imageUrl: row.image_url,
      });
    } catch (e: any) {
      console.warn(e);
    }
  };

  /* ─────── Submit (auditeur) ─────── */

  const handleSubmit = async () => {
    if (!audit) return;
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
        if (!row.image_url) miss.push('image');
        if (miss.length > 0)
          problems[q.id] = `Requis pour NOK : ${miss.join(', ')}`;
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
      for (const q of myAssignedQuestions) await saveRow(q);
      const finalAnswers = Object.values(answers) as any[];
      const sc = computeScore(finalAnswers);
      await saveAuditScore(audit.id, sc);
      await submitAudit(audit.id, sc.score);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);
      Alert.alert('Merci !', `Score : ${sc.score.toFixed(1)} %  (${sc.total_ok}/${sc.total_scored} OK)`, [
        { text: 'OK', onPress: () => router.replace('/(app)') },
      ]);
    } catch (e: any) {
      Alert.alert('Erreur', e?.message ?? 'Réessayez.');
    } finally {
      setSubmitBusy(false);
    }
  };

  /* ─────── Render ─────── */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Audit Gemba</Text>
            <Text style={styles.headerSub}>
              {isAdmin
                ? 'Mode administrateur — assignez chaque question'
                : 'Mes questions assignées'}
            </Text>
          </View>
          <View
            style={[
              styles.rolePill,
              isAdmin ? styles.rolePillAdmin : styles.rolePillMember,
            ]}
          >
            <Text style={styles.rolePillText}>
              {isAdmin ? 'ADMIN' : 'AUDITEUR'}
            </Text>
          </View>
        </View>

        {/* Ligne */}
        <TouchableOpacity
          style={styles.ligneBand}
          onPress={() => isAdmin && setLigneModal(true)}
          disabled={!isAdmin}
        >
          <Text style={styles.metaCellLabel}>LIGNE</Text>
          <Text
            style={[
              styles.metaCellValue,
              !audit?.ligne && isAdmin && { color: '#EF4444' },
            ]}
          >
            {audit?.ligne || (isAdmin ? 'Choisir…' : '—')}
          </Text>
        </TouchableOpacity>

        {isAdmin ? (
          <>
            <Text style={styles.headerStat}>
              {progress.assigned} / {progress.total} questions planifiées ·{' '}
              {progress.done} répondues
            </Text>
            <View style={styles.progressTrack}>
              <LinearGradient
                colors={['#7C3AED', '#A855F7']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[
                  styles.progressFill,
                  {
                    width: `${
                      (progress.assigned / progress.total) * 100
                    }%`,
                  },
                ]}
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
                style={[
                  styles.progressFill,
                  { width: `${myProgress.pct * 100}%` },
                ]}
              />
            </View>
          </>
        )}
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {!isAdmin && visibleQuestions.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyTitle}>Aucune question assignée</Text>
            <Text style={styles.emptyText}>
              L'administrateur n'a pas encore planifié de questions pour vous.
            </Text>
          </View>
        )}

        {visibleQuestions.map((q, i) => {
          const row = answers[q.id];
          const assigned = !!row?.assignee_id;
          const err = errors[q.id];
          const isNok = row?.answer === 'nok';

          return (
            <Animated.View
              key={q.id}
              entering={FadeInDown.delay(i * 30).duration(400)}
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
                /* ─── ADMIN : voir + planifier ─── */
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
                          {row?.answer
                            ? `Répondu : ${row.answer.toUpperCase()}`
                            : 'Planifié'}
                          {row?.pilot ? ` · Pilote : ${row.pilot}` : ''}
                          {row?.due_date ? ` · ${row.due_date}` : ''}
                        </Text>
                      </View>
                      {row?.comment ? (
                        <Text style={styles.adminComment}>💬 {row.comment}</Text>
                      ) : null}
                      <TouchableOpacity
                        style={styles.planningBtn}
                        onPress={() => openPlanning(q)}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.planningIcon}>✎</Text>
                        <Text style={styles.planningText}>
                          Modifier l'assignation
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[styles.planningBtn, styles.planningBtnPrimary]}
                      onPress={() => openPlanning(q)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.planningIcon}>📅</Text>
                      <Text
                        style={[
                          styles.planningText,
                          styles.planningTextPrimary,
                        ]}
                      >
                        Choisir un utilisateur
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : (
                /* ─── AUDITEUR : répondre ─── */
                <>
                  <Text style={styles.sectionLabel}>VOTRE RÉPONSE</Text>
                  <View style={styles.seg}>
                    {(['ok', 'nok', 'na'] as AnswerValue[]).map((val) => {
                      const active = row?.answer === val;
                      const color =
                        val === 'ok'
                          ? '#10B981'
                          : val === 'nok'
                          ? '#EF4444'
                          : '#94A3B8';
                      return (
                        <TouchableOpacity
                          key={val}
                          onPress={() => setAnswer(q, val)}
                          style={[
                            styles.segBtn,
                            active && {
                              backgroundColor: color + '20',
                              borderColor: color,
                            },
                          ]}
                          activeOpacity={0.85}
                        >
                          <Text
                            style={[
                              styles.segText,
                              active && { color, fontWeight: '900' },
                            ]}
                          >
                            {val === 'na' ? 'N/A' : val.toUpperCase()}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  <Text style={styles.sectionLabel}>
                    COMMENTAIRE
                    {isNok && <Text style={styles.requiredTag}> — OBLIGATOIRE</Text>}
                  </Text>
                  <TextInput
                    placeholder={
                      isNok ? 'Expliquez le problème…' : 'Commentaire (optionnel)'
                    }
                    value={row?.comment ?? ''}
                    onChangeText={(t) => setComment(q, t)}
                    onBlur={() => saveRow(q)}
                    multiline
                    style={[
                      styles.commentInput,
                      isNok && !(row?.comment ?? '').trim() && err
                        ? { borderColor: '#EF4444', borderWidth: 1.5 }
                        : null,
                    ]}
                    placeholderTextColor="#94A3B8"
                  />

                  <Text style={styles.sectionLabel}>
                    PILOTE
                    {isNok && <Text style={styles.requiredTag}> — OBLIGATOIRE</Text>}
                  </Text>
                  <TextInput
                    placeholder="Nom du pilote"
                    value={row?.pilot ?? ''}
                    onChangeText={(t) => setPilotQ(q, t)}
                    onBlur={() => saveRow(q)}
                    style={[
                      styles.lineInput,
                      isNok && !(row?.pilot ?? '').trim() && err
                        ? { borderColor: '#EF4444', borderWidth: 1.5 }
                        : null,
                    ]}
                    placeholderTextColor="#94A3B8"
                  />

                  <Text style={styles.sectionLabel}>
                    DATE PRÉVUE
                    {isNok && <Text style={styles.requiredTag}> — OBLIGATOIRE</Text>}
                  </Text>
                  <TextInput
                    placeholder="AAAA-MM-JJ"
                    value={row?.due_date ?? ''}
                    onChangeText={(t) => setDueDate(q, t)}
                    onBlur={() => saveRow(q)}
                    style={[
                      styles.lineInput,
                      isNok && !(row?.due_date ?? '').trim() && err
                        ? { borderColor: '#EF4444', borderWidth: 1.5 }
                        : null,
                    ]}
                    placeholderTextColor="#94A3B8"
                  />

                  {isNok && (
                    <>
                      <Text style={styles.sectionLabel}>
                        PHOTO
                        <Text style={styles.requiredTag}>
                          {' '}
                          — OBLIGATOIRE POUR NOK
                        </Text>
                      </Text>
                      {row?.image_url ? (
                        <View style={styles.imageBox}>
                          <Image
                            source={{ uri: row.image_url }}
                            style={styles.image}
                          />
                          <View style={styles.imageActions}>
                            <TouchableOpacity
                              style={styles.imageBtn}
                              onPress={() => pickAndUploadImage(q)}
                            >
                              <Text style={styles.imageBtnText}>Remplacer</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={[
                                styles.imageBtn,
                                { backgroundColor: 'rgba(239,68,68,0.1)' },
                              ]}
                              onPress={() => removeImage(q)}
                            >
                              <Text
                                style={[
                                  styles.imageBtnText,
                                  { color: '#DC2626' },
                                ]}
                              >
                                Supprimer
                              </Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                      ) : (
                        <TouchableOpacity
                          style={styles.uploadBtn}
                          onPress={() => pickAndUploadImage(q)}
                          disabled={uploadingFor === q.id}
                        >
                          {uploadingFor === q.id ? (
                            <ActivityIndicator color="#2563EB" />
                          ) : (
                            <Text style={styles.uploadBtnText}>
                              📷 Ajouter une photo
                            </Text>
                          )}
                        </TouchableOpacity>
                      )}
                    </>
                  )}

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
          >
            <LinearGradient
              colors={['#3B82F6', '#2563EB', '#1E40AF']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.submitGrad}
            >
              {submitBusy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>
                  SOUMETTRE MES RÉPONSES
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        )}

        {submitted && (
          <View style={styles.successCard}>
            <Text style={styles.successIcon}>✅</Text>
            <Text style={styles.successTitle}>Audit Gemba soumis</Text>
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Ligne modal (admin) */}
      <Modal
        visible={ligneModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLigneModal(false)}
      >
        <View style={styles.pickerBackdrop}>
          <View style={styles.pickerCard}>
            <Text style={styles.pickerTitle}>Choisir une ligne</Text>
            <ScrollView style={{ maxHeight: 400 }}>
              {lignesList.map((l) => {
                const active = audit?.ligne === l;
                return (
                  <TouchableOpacity
                    key={l}
                    style={[
                      styles.pickerRow,
                      active && styles.pickerRowActive,
                    ]}
                    onPress={() => setLigne(l)}
                  >
                    <Text
                      style={[
                        styles.pickerText,
                        active && styles.pickerTextActive,
                      ]}
                    >
                      {l}
                    </Text>
                    {active && <Text style={styles.pickerCheck}>✓</Text>}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={styles.pickerClose}
              onPress={() => setLigneModal(false)}
            >
              <Text style={styles.pickerCloseText}>Fermer</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Planning modal (admin → assigner une question à un user) */}
      <PlanningModal
        visible={!!planningFor}
        companyId={companyId}
        onClose={() => setPlanningFor(null)}
        onConfirm={confirmPlanning}
        questionTitle={
          planningFor ? `${planningFor.category} — ${planningFor.title}` : ''
        }
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
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerTitle: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: 1 },
  headerSub: { fontSize: 12, color: '#64748B', fontWeight: '600', marginTop: 2 },
  headerStat: { fontSize: 12, color: '#64748B', fontWeight: '700', marginTop: 12 },
  rolePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  rolePillAdmin: { backgroundColor: 'rgba(124,58,237,0.15)' },
  rolePillMember: { backgroundColor: 'rgba(37,99,235,0.15)' },
  rolePillText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.5, color: '#1E293B' },
  ligneBand: {
    backgroundColor: 'rgba(37,99,235,0.06)',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(37,99,235,0.25)',
  },
  metaCellLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5 },
  metaCellValue: { fontSize: 15, fontWeight: '900', color: '#0F172A', marginTop: 4 },
  progressTrack: {
    height: 6,
    backgroundColor: '#E2E8F0',
    borderRadius: 3,
    marginTop: 10,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 3 },
  scroll: { padding: 16, paddingBottom: 80 },
  empty: { alignItems: 'center', padding: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 6 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 18,
    marginBottom: 14,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  catChip: {
    backgroundColor: 'rgba(37,99,235,0.1)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  catChipText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    color: '#2563EB',
    textTransform: 'uppercase',
  },
  qIndex: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 1 },
  qTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 10,
    lineHeight: 23,
  },
  criterionRow: { flexDirection: 'row', marginBottom: 5 },
  bullet: { color: '#2563EB', fontWeight: '900', marginRight: 8, fontSize: 14 },
  criterionText: { flex: 1, fontSize: 13, color: '#475569', lineHeight: 19 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#64748B',
    letterSpacing: 1.5,
    marginTop: 14,
    marginBottom: 6,
  },
  requiredTag: { color: '#EF4444', fontWeight: '900' },
  seg: { flexDirection: 'row', gap: 8, marginTop: 4 },
  segBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  segText: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: '#94A3B8' },
  commentInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
    minHeight: 55,
    textAlignVertical: 'top',
  },
  lineInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0F172A',
  },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '700', marginTop: 6 },
  uploadBtn: {
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  uploadBtnText: { color: '#2563EB', fontWeight: '800', fontSize: 14 },
  imageBox: { marginTop: 4 },
  image: { width: '100%', height: 200, borderRadius: 12, backgroundColor: '#F1F5F9' },
  imageActions: { flexDirection: 'row', gap: 8, marginTop: 8 },
  imageBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  imageBtnText: { fontWeight: '800', fontSize: 12, color: '#334155' },
  submitBtn: { marginTop: 12, borderRadius: 16, overflow: 'hidden' },
  submitGrad: { paddingVertical: 18, alignItems: 'center' },
  submitText: { color: '#FFF', fontWeight: '900', letterSpacing: 2, fontSize: 14 },
  successCard: {
    marginTop: 16,
    padding: 24,
    backgroundColor: 'rgba(16,185,129,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(16,185,129,0.3)',
    borderRadius: 16,
    alignItems: 'center',
  },
  successIcon: { fontSize: 40, marginBottom: 8 },
  successTitle: { fontSize: 18, fontWeight: '900', color: '#059669' },
  adminBlock: { marginTop: 14 },
  assignedRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusDot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  assignedText: { fontSize: 13, color: '#334155', fontWeight: '700', flex: 1 },
  adminComment: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  planningBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.3)',
    marginTop: 6,
  },
  planningBtnPrimary: {
    backgroundColor: 'rgba(37,99,235,0.1)',
    borderColor: 'rgba(37,99,235,0.4)',
  },
  planningIcon: { fontSize: 16, marginRight: 8 },
  planningText: {
    flex: 1,
    color: '#7C3AED',
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.5,
  },
  planningTextPrimary: { color: '#2563EB' },
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  pickerCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    maxHeight: '85%',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0F172A',
    marginBottom: 14,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F8FAFC',
    marginBottom: 6,
  },
  pickerRowActive: { backgroundColor: 'rgba(37,99,235,0.12)' },
  pickerText: { flex: 1, fontSize: 15, fontWeight: '700', color: '#334155' },
  pickerTextActive: { color: '#2563EB' },
  pickerCheck: { fontSize: 16, fontWeight: '900', color: '#2563EB' },
  pickerClose: {
    marginTop: 12,
    paddingVertical: 12,
    backgroundColor: '#F1F5F9',
    borderRadius: 10,
    alignItems: 'center',
  },
  pickerCloseText: { color: '#475569', fontWeight: '800' },
});
