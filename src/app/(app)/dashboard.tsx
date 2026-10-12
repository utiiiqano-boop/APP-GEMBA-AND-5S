import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator, RefreshControl } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useFocusEffect } from 'expo-router';
import Svg, { Rect, Circle, G, Text as SvgText } from 'react-native-svg';
import { getMyCompanyId, getMyRole, listSubmissions, Role, Submission } from '../../features/audit/auditService';
import { listActionPlans, ActionPlan } from '../../features/audit/actionPlanService';

export default function DashboardScreen() {
  const [role, setRole] = useState<Role>('member');
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [gemba, setGemba] = useState<Submission[]>([]);
  const [fiveS, setFiveS] = useState<Submission[]>([]);
  const [plans, setPlans] = useState<ActionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const isAdmin = role === 'owner' || role === 'admin';

  const load = useCallback(async () => {
    const cid = await getMyCompanyId();
    setCompanyId(cid);
    if (!cid) return;
    const r = await getMyRole(cid);
    setRole(r);
    const [g, f, p] = await Promise.all([
      listSubmissions(cid, 'gemba'),
      listSubmissions(cid, '5s'),
      listActionPlans(cid),
    ]);
    setGemba(g); setFiveS(f); setPlans(p);
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);
  useFocusEffect(useCallback(() => { (async () => { if (companyId) await load(); })(); }, [companyId, load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  if (loading) return (<View style={styles.center}><ActivityIndicator color="#2563EB" size="large" /></View>);
  if (!isAdmin) return (<View style={styles.center}><Text style={styles.lock}>🔒 Accès réservé</Text></View>);

  const allSubs = [...gemba, ...fiveS];
  const scored = allSubs.filter((s) => s.status === 'submitted' && (s.total_scored ?? 0) > 0);
  const avgScore = scored.length ? scored.reduce((sum, s) => sum + (s.score ?? 0), 0) / scored.length : 0;
  const totalOK = allSubs.reduce((n, s) => n + (s.total_ok ?? 0), 0);
  const totalNOK = allSubs.reduce((n, s) => n + (s.total_nok ?? 0), 0);
  const totalNA = allSubs.reduce((n, s) => n + (s.total_na ?? 0), 0);
  const totalScored = totalOK + totalNOK;

  const byLigne: Record<string, number> = {};
  for (const s of scored) { byLigne[s.ligne ?? s.zone ?? '?'] = s.score ?? 0; }
  const barData = Object.entries(byLigne).slice(0, 8);

  const pieTotal = totalScored + totalNA || 1;
  const pieOkPct = totalOK / pieTotal;
  const pieNokPct = totalNOK / pieTotal;
  const pieNaPct = totalNA / pieTotal;

  const openPlans = plans.filter((p) => p.status === 'open').length;
  const inProgressPlans = plans.filter((p) => p.status === 'in_progress').length;
  const donePlans = plans.filter((p) => p.status === 'done').length;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
      <Text style={styles.pageTitle}>Tableau de bord</Text>
      <Text style={styles.pageSub}>{allSubs.length} audits · score moyen {avgScore.toFixed(1)} %</Text>

      <View style={styles.kpiRow}>
        <View style={[styles.kpiCard, { borderLeftColor: '#2563EB' }]}>
          <Text style={styles.kpiLabel}>SCORE MOYEN</Text>
          <Text style={[styles.kpiValue, { color: avgScore >= 80 ? '#059669' : avgScore >= 60 ? '#F59E0B' : '#DC2626' }]}>
            {avgScore.toFixed(1)}%
          </Text>
          <Text style={styles.kpiSub}>{scored.length} audits notés</Text>
        </View>
        <View style={[styles.kpiCard, { borderLeftColor: '#DC2626' }]}>
          <Text style={styles.kpiLabel}>ACTIONS OUVERTES</Text>
          <Text style={[styles.kpiValue, { color: '#DC2626' }]}>{openPlans}</Text>
          <Text style={styles.kpiSub}>{inProgressPlans} en cours</Text>
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
        <Text style={styles.cardTitle}>Score par ligne</Text>
        <Svg width="100%" height={200} viewBox="0 0 320 200">
          {barData.map(([ligne, score], i) => {
            const barW = 30, gap = 8;
            const x = 10 + i * (barW + gap);
            const h = (score / 100) * 160;
            const y = 180 - h;
            const color = score >= 80 ? '#059669' : score >= 60 ? '#F59E0B' : '#DC2626';
            return (
              <G key={ligne}>
                <Rect x={x} y={y} width={barW} height={h} fill={color} rx={4} />
                <SvgText x={x + barW / 2} y={y - 6} fontSize="10" fontWeight="800" fill="#0F172A" textAnchor="middle">{score.toFixed(0)}</SvgText>
                <SvgText x={x + barW / 2} y={195} fontSize="9" fill="#64748B" textAnchor="middle">{ligne.slice(0, 4)}</SvgText>
              </G>
            );
          })}
        </Svg>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(100).duration(400)} style={styles.card}>
        <Text style={styles.cardTitle}>Répartition globale</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', marginTop: 10 }}>
          <Svg width={140} height={140} viewBox="0 0 140 140">
            <G rotation={-90} originX={70} originY={70}>
              <Circle cx={70} cy={70} r={55} stroke="#059669" strokeWidth={20}
                strokeDasharray={`${pieOkPct * 345.5} 345.5`} fill="none" />
              <Circle cx={70} cy={70} r={55} stroke="#DC2626" strokeWidth={20}
                strokeDasharray={`${pieNokPct * 345.5} 345.5`} strokeDashoffset={-pieOkPct * 345.5} fill="none" />
              <Circle cx={70} cy={70} r={55} stroke="#94A3B8" strokeWidth={20}
                strokeDasharray={`${pieNaPct * 345.5} 345.5`} strokeDashoffset={-(pieOkPct + pieNokPct) * 345.5} fill="none" />
            </G>
            <SvgText x={70} y={70} fontSize="24" fontWeight="900" fill="#0F172A" textAnchor="middle">{Math.round(pieOkPct * 100)}%</SvgText>
            <SvgText x={70} y={86} fontSize="10" fill="#64748B" textAnchor="middle">OK</SvgText>
          </Svg>
          <View style={{ gap: 10 }}>
            <View style={styles.legend}><View style={[styles.legendDot, { backgroundColor: '#059669' }]} /><Text style={styles.legendText}>OK ({totalOK})</Text></View>
            <View style={styles.legend}><View style={[styles.legendDot, { backgroundColor: '#DC2626' }]} /><Text style={styles.legendText}>NOK ({totalNOK})</Text></View>
            <View style={styles.legend}><View style={[styles.legendDot, { backgroundColor: '#94A3B8' }]} /><Text style={styles.legendText}>N/A ({totalNA})</Text></View>
          </View>
        </View>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(200).duration(400)} style={styles.card}>
        <Text style={styles.cardTitle}>Plan d'actions</Text>
        <View style={styles.planRow}>
          <View style={[styles.planBox, { backgroundColor: 'rgba(220,38,38,0.08)' }]}>
            <Text style={[styles.planNum, { color: '#DC2626' }]}>{openPlans}</Text>
            <Text style={styles.planLbl}>OUVERTES</Text>
          </View>
          <View style={[styles.planBox, { backgroundColor: 'rgba(245,158,11,0.1)' }]}>
            <Text style={[styles.planNum, { color: '#F59E0B' }]}>{inProgressPlans}</Text>
            <Text style={styles.planLbl}>EN COURS</Text>
          </View>
          <View style={[styles.planBox, { backgroundColor: 'rgba(5,150,105,0.1)' }]}>
            <Text style={[styles.planNum, { color: '#059669' }]}>{donePlans}</Text>
            <Text style={styles.planLbl}>FERMÉES</Text>
          </View>
        </View>
      </Animated.View>

      <View style={{ height: 60 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  lock: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  pageTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  pageSub: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 20, fontWeight: '600' },
  kpiRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  kpiCard: { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, borderLeftWidth: 4, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  kpiLabel: { fontSize: 10, fontWeight: '900', color: '#94A3B8', letterSpacing: 1.5 },
  kpiValue: { fontSize: 32, fontWeight: '900', marginTop: 4 },
  kpiSub: { fontSize: 11, color: '#64748B', marginTop: 2, fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  cardTitle: { fontSize: 14, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5, marginBottom: 12 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legendDot: { width: 12, height: 12, borderRadius: 3 },
  legendText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  planRow: { flexDirection: 'row', gap: 10 },
  planBox: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  planNum: { fontSize: 26, fontWeight: '900' },
  planLbl: { fontSize: 9, fontWeight: '900', color: '#94A3B8', letterSpacing: 1, marginTop: 4 },
});
