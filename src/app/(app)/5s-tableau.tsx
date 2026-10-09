import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  RefreshControl, TouchableOpacity, Image,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import { getMyCompanyId, getMyRole, listSubmissions, Role, GembaSubmission } from '../../features/audit/auditService';
import { SECTIONS_5S } from '../../features/audit/questions5s';

export default function Tableau5SScreen() {
  const [role, setRole] = useState<Role>('member');
  const [submissions, setSubmissions] = useState<GembaSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const isAdmin = role === 'owner' || role === 'admin';

  const load = useCallback(async () => {
    const cid = await getMyCompanyId();
    if (!cid) return;
    const r = await getMyRole(cid);
    setRole(r);
    if (r !== 'owner' && r !== 'admin') return;
    const subs = await listSubmissions(cid, '5s');
    setSubmissions(subs);
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);
  useFocusEffect(useCallback(() => { (async () => { await load(); })(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return (<View style={styles.center}><ActivityIndicator color="#2563EB" size="large" /></View>);
  if (!isAdmin) return (
    <View style={styles.center}>
      <Text style={styles.lockIcon}>🔒</Text>
      <Text style={styles.lockTitle}>Accès réservé</Text>
    </View>
  );

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.pageTitle}>Tableau 5S</Text>
      <Text style={styles.pageSub}>{submissions.length} audit(s) 5S</Text>

      {submissions.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Aucun audit 5S</Text>
        </View>
      )}

      {submissions.map((s, i) => {
        const open = openId === s.audit_id;
        const total = s.answers.length;
        const done = s.answers.filter((a) => a.status === 'done').length;
        const nok = s.answers.filter((a) => a.answer === 'nok').length;
        const ok = s.answers.filter((a) => a.answer === 'ok').length;
        const na = s.answers.filter((a) => a.answer === 'na').length;

        return (
          <Animated.View key={s.audit_id} entering={FadeInDown.delay(i * 40).duration(400)} style={styles.card}>
            <TouchableOpacity activeOpacity={0.85} onPress={() => setOpenId(open ? null : s.audit_id)}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLigne}>{s.zone ?? s.ligne ?? 'Zone non définie'}</Text>
                  <Text style={styles.cardDate}>
                    {s.audit_date ? new Date(s.audit_date).toLocaleDateString() : new Date(s.created_at).toLocaleDateString()}
                    {s.auditeur_email ? ` · Auditeur : ${s.auditeur_email}` : ''}
                  </Text>
                </View>
                <View style={[styles.statusPill, s.status === 'submitted' ? styles.statusOk : styles.statusDraft]}>
                  <Text style={styles.statusText}>{s.status === 'submitted' ? 'SOUMIS' : 'BROUILLON'}</Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statChip}><Text style={styles.statLabel}>RÉPONDU</Text><Text style={styles.statValue}>{done}/{total}</Text></View>
                <View style={[styles.statChip, { backgroundColor: 'rgba(16,185,129,0.1)' }]}><Text style={styles.statLabel}>OK</Text><Text style={[styles.statValue, { color: '#059669' }]}>{ok}</Text></View>
                <View style={[styles.statChip, { backgroundColor: 'rgba(239,68,68,0.08)' }]}><Text style={styles.statLabel}>NOK</Text><Text style={[styles.statValue, { color: '#DC2626' }]}>{nok}</Text></View>
                <View style={[styles.statChip, { backgroundColor: 'rgba(148,163,184,0.12)' }]}><Text style={styles.statLabel}>N/A</Text><Text style={[styles.statValue, { color: '#64748B' }]}>{na}</Text></View>
              </View>

              <Text style={styles.expandHint}>{open ? '▲ Masquer' : '▼ Voir le détail'}</Text>
            </TouchableOpacity>

            {open && (
              <View style={styles.detailBox}>
                {SECTIONS_5S.map((section) => {
                  const rows = section.questions.map((q) => {
                    const r = s.answers.find((a) => a.question_id === q.label);
                    return { q, r };
                  });
                  const answered = rows.filter((x) => x.r?.answer).length;
                  if (answered === 0) return null;

                  return (
                    <View key={section.step} style={styles.sectionBlock}>
                      <View style={styles.sectionHead}>
                        <View style={styles.sectionBadge}><Text style={styles.sectionBadgeText}>{section.step}</Text></View>
                        <Text style={styles.sectionTitle}>{section.title}</Text>
                      </View>

                      {rows.map(({ q, r }) => {
                        if (!r?.answer && r?.status !== 'planned') return null;
                        return (
                          <View key={q.label} style={styles.detailRow}>
                            <View style={styles.detailHead}>
                              <Text style={styles.detailLabel}>{q.label}</Text>
                              {r?.answer && (
                                <View style={[
                                  styles.answerChip,
                                  r.answer === 'ok' && { backgroundColor: 'rgba(16,185,129,0.15)' },
                                  r.answer === 'nok' && { backgroundColor: 'rgba(239,68,68,0.15)' },
                                  r.answer === 'na' && { backgroundColor: 'rgba(148,163,184,0.18)' },
                                ]}>
                                  <Text style={[
                                    styles.answerChipText,
                                    r.answer === 'ok' && { color: '#059669' },
                                    r.answer === 'nok' && { color: '#DC2626' },
                                    r.answer === 'na' && { color: '#64748B' },
                                  ]}>
                                    {r.answer === 'na' ? 'N/A' : r.answer.toUpperCase()}
                                  </Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.detailTitle}>{q.text}</Text>
                            {r?.comment ? <Text style={styles.detailComment}>💬 {r.comment}</Text> : null}
                            {(r?.pilot || r?.due_date) && (
                              <View style={styles.metaTags}>
                                {r?.pilot ? <Text style={styles.metaTag}>👤 {r.pilot}</Text> : null}
                                {r?.due_date ? <Text style={styles.metaTag}>📅 {r.due_date}</Text> : null}
                              </View>
                            )}

                            {/* PHOTO du NOK */}
                            {r?.image_url ? (
                              <Image source={{ uri: r.image_url }} style={styles.evidence} />
                            ) : null}
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            )}
          </Animated.View>
        );
      })}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#F8FAFC' },
  lockIcon: { fontSize: 48, marginBottom: 12 },
  lockTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  pageTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  pageSub: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 20, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 18, marginBottom: 14, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLigne: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  cardDate: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '600' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusOk: { backgroundColor: 'rgba(16,185,129,0.15)' },
  statusDraft: { backgroundColor: 'rgba(148,163,184,0.2)' },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#1E293B' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statChip: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F1F5F9' },
  statLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.2 },
  statValue: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  expandHint: { marginTop: 12, fontSize: 12, fontWeight: '800', color: '#2563EB', textAlign: 'center' },
  detailBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  sectionBlock: { marginBottom: 18 },
  sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  sectionBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  sectionBadgeText: { color: '#FFF', fontWeight: '900', fontSize: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A' },
  detailRow: { marginBottom: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  detailLabel: { fontSize: 12, fontWeight: '900', color: '#64748B', letterSpacing: 1 },
  answerChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  answerChipText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  detailTitle: { fontSize: 13, fontWeight: '700', color: '#0F172A', lineHeight: 18 },
  detailComment: { fontSize: 12, color: '#475569', marginTop: 4, fontStyle: 'italic' },
  metaTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  metaTag: { fontSize: 11, color: '#475569', fontWeight: '700', backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  evidence: { width: '100%', height: 200, borderRadius: 12, marginTop: 10, backgroundColor: '#F1F5F9' },
});
