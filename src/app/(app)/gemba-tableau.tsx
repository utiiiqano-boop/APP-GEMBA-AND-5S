import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import {
  getMyCompanyId,
  getMyRole,
  listSubmissions,
  Submission,
  Role,
} from '../../features/audit/auditService';
import { GEMBA_QUESTIONS } from '../../features/audit/questions';

const CATEGORY_COLORS: Record<string, string> = {
  "Main d'œuvre": '#2563EB',
  'Matière': '#7C3AED',
  'Méthode': '#0891B2',
  'Milieu': '#059669',
  'Machine': '#F59E0B',
};

export default function GembaTableauScreen() {
  const [role, setRole] = useState<Role>('member');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
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
    const subs = await listSubmissions(cid, 'gemba');
    setSubmissions(subs);
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
        await load();
      })();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" size="large" />
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Accès réservé</Text>
        <Text style={styles.lockText}>
          Seuls les administrateurs peuvent consulter le tableau des audits.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Text style={styles.pageTitle}>Tableau Gemba</Text>
      <Text style={styles.pageSub}>
        {submissions.length} audit(s) ·{' '}
        {submissions.filter((s) => s.status === 'submitted').length} soumis
      </Text>

      {submissions.length === 0 && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyIcon}>📋</Text>
          <Text style={styles.emptyTitle}>Aucun audit pour le moment</Text>
          <Text style={styles.emptyText}>
            Les audits apparaîtront ici dès qu'ils seront créés.
          </Text>
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
          <Animated.View
            key={s.audit_id}
            entering={FadeInDown.delay(i * 40).duration(400)}
            style={styles.card}
          >
            <TouchableOpacity activeOpacity={0.85} onPress={() => setOpenId(open ? null : s.audit_id)}>
              <View style={styles.cardHead}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardLigne}>{s.ligne ?? s.zone ?? 'Ligne non définie'}</Text>
                  <Text style={styles.cardDate}>
                    {s.audit_date
                      ? new Date(s.audit_date).toLocaleDateString()
                      : new Date(s.created_at).toLocaleDateString()}
                    {s.auditeur_email ? ` · Auditeur : ${s.auditeur_email}` : ''}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    s.status === 'submitted' ? styles.statusOk : styles.statusDraft,
                  ]}
                >
                  <Text style={styles.statusText}>
                    {s.status === 'submitted' ? 'SOUMIS' : 'BROUILLON'}
                  </Text>
                </View>
              </View>

              <View style={styles.statsRow}>
                <View style={styles.statChip}>
                  <Text style={styles.statLabel}>RÉPONDU</Text>
                  <Text style={styles.statValue}>{done}/{total}</Text>
                </View>
                <View style={[styles.statChip, styles.statOk]}>
                  <Text style={styles.statLabel}>OK</Text>
                  <Text style={[styles.statValue, { color: '#059669' }]}>{ok}</Text>
                </View>
                <View style={[styles.statChip, styles.statNok]}>
                  <Text style={styles.statLabel}>NOK</Text>
                  <Text style={[styles.statValue, { color: '#DC2626' }]}>{nok}</Text>
                </View>
                <View style={[styles.statChip, styles.statNa]}>
                  <Text style={styles.statLabel}>N/A</Text>
                  <Text style={[styles.statValue, { color: '#64748B' }]}>{na}</Text>
                </View>
              </View>

              <Text style={styles.expandHint}>
                {open ? '▲ Masquer le détail' : '▼ Voir le détail'}
              </Text>
            </TouchableOpacity>

            {open && (
              <View style={styles.detailBox}>
                {GEMBA_QUESTIONS.map((q, qi) => {
                  const row = s.answers.find((a) => a.question_id === q.id);
                  const color = CATEGORY_COLORS[q.category] ?? '#2563EB';
                  return (
                    <View key={q.id} style={styles.detailRow}>
                      <View style={styles.detailHead}>
                        <View style={[styles.detailCat, { backgroundColor: color + '18' }]}>
                          <Text style={[styles.detailCatText, { color }]}>{q.category}</Text>
                        </View>
                        <Text style={styles.detailIndex}>Q{qi + 1}</Text>
                        {row?.answer && (
                          <View
                            style={[
                              styles.answerChip,
                              row.answer === 'ok' && { backgroundColor: 'rgba(16,185,129,0.15)' },
                              row.answer === 'nok' && { backgroundColor: 'rgba(239,68,68,0.15)' },
                              row.answer === 'na' && { backgroundColor: 'rgba(148,163,184,0.18)' },
                            ]}
                          >
                            <Text
                              style={[
                                styles.answerChipText,
                                row.answer === 'ok' && { color: '#059669' },
                                row.answer === 'nok' && { color: '#DC2626' },
                                row.answer === 'na' && { color: '#64748B' },
                              ]}
                            >
                              {row.answer === 'na' ? 'N/A' : row.answer.toUpperCase()}
                            </Text>
                          </View>
                        )}
                        {!row?.answer && row?.status === 'planned' && (
                          <View style={[styles.answerChip, { backgroundColor: 'rgba(124,58,237,0.15)' }]}>
                            <Text style={[styles.answerChipText, { color: '#7C3AED' }]}>PLANIFIÉ</Text>
                          </View>
                        )}
                      </View>

                      <Text style={styles.detailTitle}>{q.title}</Text>

                      {row?.comment ? (
                        <Text style={styles.detailComment}>💬 {row.comment}</Text>
                      ) : null}

                      {(row?.pilot || row?.due_date) && (
                        <View style={styles.metaTags}>
                          {row?.pilot ? <Text style={styles.metaTag}>👤 {row.pilot}</Text> : null}
                          {row?.due_date ? <Text style={styles.metaTag}>📅 {row.due_date}</Text> : null}
                        </View>
                      )}

                      {row?.image_url ? (
                        <Image source={{ uri: row.image_url }} style={styles.evidence} />
                      ) : null}
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
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#F8FAFC',
  },
  lockIcon: { fontSize: 48, marginBottom: 12 },
  lockTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  lockText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8 },
  pageTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5 },
  pageSub: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 20, fontWeight: '600' },
  emptyBox: { alignItems: 'center', paddingVertical: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 6 },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center' },
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
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardLigne: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5 },
  cardDate: { fontSize: 12, color: '#64748B', marginTop: 4, fontWeight: '600' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusOk: { backgroundColor: 'rgba(16,185,129,0.15)' },
  statusDraft: { backgroundColor: 'rgba(148,163,184,0.2)' },
  statusText: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: '#1E293B' },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  statChip: { flex: 1, paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#F1F5F9' },
  statOk: { backgroundColor: 'rgba(16,185,129,0.1)' },
  statNok: { backgroundColor: 'rgba(239,68,68,0.08)' },
  statNa: { backgroundColor: 'rgba(148,163,184,0.12)' },
  statLabel: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.2 },
  statValue: { fontSize: 16, fontWeight: '900', color: '#0F172A', marginTop: 2 },
  expandHint: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '800',
    color: '#2563EB',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  detailBox: { marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#E2E8F0' },
  detailRow: {
    marginBottom: 14,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  detailHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  detailCat: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  detailCatText: { fontSize: 9, fontWeight: '900', letterSpacing: 1.2, textTransform: 'uppercase' },
  detailIndex: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 0.5 },
  answerChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  answerChipText: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  detailTitle: { fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 4 },
  detailComment: { fontSize: 12, color: '#475569', marginTop: 4, fontStyle: 'italic', lineHeight: 17 },
  metaTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  metaTag: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '700',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  evidence: {
    width: '100%',
    height: 220,
    borderRadius: 12,
    marginTop: 10,
    backgroundColor: '#F1F5F9',
  },
});
