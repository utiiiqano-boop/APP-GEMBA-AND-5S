import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, RefreshControl, Modal,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { getMyCompanyId, getMyRole, Role } from '../../features/audit/auditService';
import { listActionPlans, updateActionPlan, ActionPlan } from '../../features/audit/actionPlanService';

const STATUS_COLORS: Record<ActionPlan['status'], string> = {
  open: '#DC2626', in_progress: '#F59E0B', done: '#059669', cancelled: '#94A3B8',
};
const STATUS_LABELS: Record<ActionPlan['status'], string> = {
  open: 'OUVERT', in_progress: 'EN COURS', done: 'FERMÉ', cancelled: 'ANNULÉ',
};
const PRIORITY_COLORS: Record<ActionPlan['priority'], string> = {
  low: '#94A3B8', medium: '#F59E0B', high: '#DC2626',
};

export default function ActionPlansScreen() {
  const [role, setRole] = useState<Role>('member');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | ActionPlan['status']>('all');
  const [editing, setEditing] = useState<ActionPlan | null>(null);
  const [formStatus, setFormStatus] = useState<ActionPlan['status']>('open');
  const [formPriority, setFormPriority] = useState<ActionPlan['priority']>('medium');
  const [formPilot, setFormPilot] = useState('');
  const [formDueDate, setFormDueDate] = useState('');
  const [busy, setBusy] = useState(false);

  const isAdmin = role === 'owner' || role === 'admin';

  const load = useCallback(async () => {
    const cid = await getMyCompanyId();
    setCompanyId(cid);
    if (!cid) return;
    const r = await getMyRole(cid);
    setRole(r);
    setPlans(await listActionPlans(cid));
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);
  useFocusEffect(useCallback(() => { (async () => { if (companyId) await load(); })(); }, [companyId, load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const openEdit = (p: ActionPlan) => {
    setEditing(p);
    setFormStatus(p.status);
    setFormPriority(p.priority);
    setFormPilot(p.pilot ?? '');
    setFormDueDate(p.due_date ?? '');
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      await updateActionPlan(editing.id, {
        status: formStatus,
        priority: formPriority,
        pilot: formPilot.trim() || null,
        due_date: formDueDate.trim() || null,
      });
      setEditing(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await load();
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally { setBusy(false); }
  };

  const visible = filter === 'all' ? plans : plans.filter((p) => p.status === filter);
  const counts = {
    all: plans.length,
    open: plans.filter((p) => p.status === 'open').length,
    in_progress: plans.filter((p) => p.status === 'in_progress').length,
    done: plans.filter((p) => p.status === 'done').length,
    cancelled: plans.filter((p) => p.status === 'cancelled').length,
  };

  if (loading) return (<View style={styles.center}><ActivityIndicator color="#2563EB" size="large" /></View>);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.title}>Plan d'actions</Text>
        <Text style={styles.sub}>{counts.open + counts.in_progress} action(s) en cours</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
        {(['all', 'open', 'in_progress', 'done', 'cancelled'] as const).map((f) => (
          <TouchableOpacity key={f} style={[styles.filterChip, filter === f && styles.filterChipActive]} onPress={() => setFilter(f)}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'TOUT' : STATUS_LABELS[f as ActionPlan['status']]} ({counts[f]})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {visible.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>✅</Text>
            <Text style={styles.emptyTitle}>Aucune action</Text>
            <Text style={styles.emptyText}>Les NOK des audits apparaîtront ici automatiquement.</Text>
          </View>
        )}

        {visible.map((p, i) => (
          <Animated.View key={p.id} entering={FadeInDown.delay(i * 30).duration(300)} style={styles.card}>
            <View style={styles.cardHead}>
              <View style={[styles.priorityDot, { backgroundColor: PRIORITY_COLORS[p.priority] }]} />
              <Text style={styles.questionId}>{p.question_id}</Text>
              <View style={{ flex: 1 }} />
              <View style={[styles.statusPill, { backgroundColor: STATUS_COLORS[p.status] + '20' }]}>
                <Text style={[styles.statusText, { color: STATUS_COLORS[p.status] }]}>{STATUS_LABELS[p.status]}</Text>
              </View>
            </View>
            <Text style={styles.description}>{p.description}</Text>
            <View style={styles.metaRow}>
              {p.pilot ? <Text style={styles.metaTag}>👤 {p.pilot}</Text> : null}
              {p.due_date ? <Text style={styles.metaTag}>📅 {p.due_date}</Text> : null}
              <Text style={[styles.metaTag, { backgroundColor: PRIORITY_COLORS[p.priority] + '15', color: PRIORITY_COLORS[p.priority] }]}>
                {p.priority.toUpperCase()}
              </Text>
            </View>
            {isAdmin && (
              <TouchableOpacity style={styles.editBtn} onPress={() => openEdit(p)}>
                <Text style={styles.editText}>✎ Mettre à jour</Text>
              </TouchableOpacity>
            )}
          </Animated.View>
        ))}

        <View style={{ height: 60 }} />
      </ScrollView>

      <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => setEditing(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Mettre à jour l'action</Text>
            <Text style={styles.modalSub}>{editing?.question_id}</Text>

            <Text style={styles.label}>STATUT</Text>
            <View style={styles.chipRow}>
              {(['open', 'in_progress', 'done', 'cancelled'] as const).map((s) => (
                <TouchableOpacity key={s}
                  style={[styles.chip, formStatus === s && { backgroundColor: STATUS_COLORS[s], borderColor: STATUS_COLORS[s] }]}
                  onPress={() => setFormStatus(s)}>
                  <Text style={[styles.chipText, formStatus === s && { color: '#FFF' }]}>{STATUS_LABELS[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>PRIORITÉ</Text>
            <View style={styles.chipRow}>
              {(['low', 'medium', 'high'] as const).map((s) => (
                <TouchableOpacity key={s}
                  style={[styles.chip, formPriority === s && { backgroundColor: PRIORITY_COLORS[s], borderColor: PRIORITY_COLORS[s] }]}
                  onPress={() => setFormPriority(s)}>
                  <Text style={[styles.chipText, formPriority === s && { color: '#FFF' }]}>{s.toUpperCase()}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>PILOTE</Text>
            <TextInput value={formPilot} onChangeText={setFormPilot} placeholder="Nom du pilote"
              placeholderTextColor="#94A3B8" style={styles.input} />

            <Text style={styles.label}>DATE PRÉVUE</Text>
            <TextInput value={formDueDate} onChangeText={setFormDueDate} placeholder="AAAA-MM-JJ"
              placeholderTextColor="#94A3B8" style={styles.input} />

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#F1F5F9' }]} onPress={() => setEditing(null)}>
                <Text style={{ color: '#475569', fontWeight: '800' }}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: '#2563EB' }]} onPress={saveEdit} disabled={busy}>
                {busy ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: '#FFF', fontWeight: '800' }}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  header: { padding: 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  title: { fontSize: 24, fontWeight: '900', color: '#0F172A' },
  sub: { fontSize: 13, color: '#64748B', marginTop: 4, fontWeight: '600' },
  filters: { flexGrow: 0, paddingVertical: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: '#2563EB', borderColor: '#2563EB' },
  filterText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  filterTextActive: { color: '#FFFFFF' },
  scroll: { padding: 16 },
  empty: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  emptyText: { fontSize: 13, color: '#64748B', textAlign: 'center', marginTop: 6, paddingHorizontal: 24 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  priorityDot: { width: 10, height: 10, borderRadius: 5 },
  questionId: { fontSize: 12, fontWeight: '900', color: '#2563EB', letterSpacing: 1 },
  statusPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  statusText: { fontSize: 9, fontWeight: '900', letterSpacing: 1 },
  description: { fontSize: 14, color: '#0F172A', fontWeight: '600', marginBottom: 10, lineHeight: 19 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  metaTag: { fontSize: 11, color: '#475569', fontWeight: '700', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  editBtn: { paddingVertical: 10, backgroundColor: 'rgba(37,99,235,0.08)', borderRadius: 10, alignItems: 'center' },
  editText: { color: '#2563EB', fontWeight: '800', fontSize: 12 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', justifyContent: 'center', padding: 20 },
  modalCard: { backgroundColor: '#FFF', borderRadius: 18, padding: 20 },
  modalTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
  modalSub: { fontSize: 12, color: '#94A3B8', marginTop: 2, marginBottom: 16, fontWeight: '700' },
  label: { fontSize: 11, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5, marginTop: 12, marginBottom: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
  chipText: { fontSize: 11, fontWeight: '800', color: '#475569' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 14, color: '#0F172A' },
  modalBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
});
