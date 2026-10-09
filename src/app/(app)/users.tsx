import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  Share,
  RefreshControl,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../features/auth/AuthProvider';
import {
  getMyCompanyId,
  getMyRole,
  listCompanyMembers,
  CompanyMember,
  Role,
} from '../../features/audit/auditService';
import {
  createInviteCode,
  listInviteCodes,
  deactivateInviteCode,
  deleteInviteCode,
  InviteCode,
} from '../../features/audit/inviteService';

export default function UsersScreen() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>('member');
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [codes, setCodes] = useState<InviteCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);

  const isAdmin = role === 'owner' || role === 'admin';

  const load = useCallback(async () => {
    try {
      const cid = await getMyCompanyId();
      setCompanyId(cid);
      if (!cid) return;
      const r = await getMyRole(cid);
      setRole(r);
      const [m, c] = await Promise.all([listCompanyMembers(cid), listInviteCodes(cid)]);
      setMembers(m);
      setCodes(c);
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

  const generate = async () => {
    if (!companyId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGenerating(true);
    try {
      const c = await createInviteCode(companyId, { role: 'member', maxUses: 1, expiresInDays: 7 });
      setCodes((s) => [c, ...s]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copyCode = async (c: InviteCode) => {
    await Clipboard.setStringAsync(c.code);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (Platform.OS !== 'web') Alert.alert('Copié', `Code ${c.code} copié.`);
  };

  const shareWhatsApp = async (c: InviteCode) => {
    const message =
      `Rejoignez notre espace GEMBA 5S 👇\n\n` +
      `Code d'invitation : *${c.code}*\n\n` +
      `Instructions :\n` +
      `1. Ouvrez l'application GEMBA 5S\n` +
      `2. Cliquez sur "Rejoindre avec un code"\n` +
      `3. Entrez le code, votre email et un mot de passe\n\n` +
      `À bientôt !`;
    try {
      if (Platform.OS === 'web') {
        const url = `https://wa.me/?text=${encodeURIComponent(message)}`;
        if (typeof window !== 'undefined') window.open(url, '_blank');
      } else {
        await Share.share({ message });
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      console.warn(e);
    }
  };

  const deactivate = (c: InviteCode) => {
    Alert.alert('Désactiver ce code ?', c.code, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Désactiver',
        style: 'destructive',
        onPress: async () => {
          await deactivateInviteCode(c.id);
          setCodes((s) => s.map((x) => (x.id === c.id ? { ...x, is_active: false } : x)));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        },
      },
    ]);
  };

  const remove = (c: InviteCode) => {
    Alert.alert('Supprimer ce code ?', c.code, [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          await deleteInviteCode(c.id);
          setCodes((s) => s.filter((x) => x.id !== c.id));
        },
      },
    ]);
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
          Seuls les administrateurs peuvent gérer les utilisateurs.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Animated.View entering={FadeInDown.duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>Membres de l'entreprise</Text>
        <Text style={styles.sectionSub}>{members.length} utilisateur(s)</Text>
        {members.map((m, i) => (
          <Animated.View key={m.user_id} entering={FadeInDown.delay(i * 50).duration(400)} style={styles.memberRow}>
            <View style={[styles.avatar, m.role !== 'member' && styles.avatarAdmin]}>
              <Text style={styles.avatarText}>
                {m.full_name?.[0]?.toUpperCase() ?? m.email?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName} numberOfLines={1}>
                {m.full_name || m.email || 'Utilisateur'}{' '}
                {user?.id === m.user_id && <Text style={styles.youTag}>(vous)</Text>}
              </Text>
              <Text style={styles.memberRole} numberOfLines={1}>
                {m.email}
              </Text>
            </View>
            <View style={[styles.roleBadge, m.role !== 'member' ? styles.roleBadgeAdmin : styles.roleBadgeMember]}>
              <Text style={styles.roleBadgeText}>
                {m.role === 'owner' ? 'OWNER' : m.role === 'admin' ? 'ADMIN' : 'MEMBRE'}
              </Text>
            </View>
          </Animated.View>
        ))}
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(150).duration(500)} style={styles.generateWrap}>
        <TouchableOpacity activeOpacity={0.9} onPress={generate} disabled={generating}>
          <LinearGradient
            colors={['#3B82F6', '#2563EB', '#1E40AF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.generateBtn}
          >
            {generating ? <ActivityIndicator color="#fff" /> : <Text style={styles.generateText}>+ GÉNÉRER UN CODE D'INVITATION</Text>}
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View entering={FadeInDown.delay(250).duration(500)} style={styles.section}>
        <Text style={styles.sectionTitle}>Codes actifs</Text>
        <Text style={styles.sectionSub}>{codes.filter((c) => c.is_active).length} code(s) actif(s)</Text>

        {codes.length === 0 && <Text style={styles.empty}>Aucun code pour le moment.</Text>}

        {codes.map((c, i) => (
          <Animated.View
            key={c.id}
            entering={FadeInDown.delay(i * 40).duration(400)}
            style={[styles.codeCard, !c.is_active && styles.codeCardInactive]}
          >
            <View style={styles.codeHeader}>
              <Text style={[styles.codeValue, !c.is_active && { color: '#94A3B8' }]}>{c.code}</Text>
              <View style={[styles.statusDot, { backgroundColor: c.is_active ? '#10B981' : '#94A3B8' }]} />
            </View>
            <Text style={styles.codeMeta}>
              {c.uses_count}/{c.max_uses} utilisation(s) · {c.expires_at ? `expire le ${new Date(c.expires_at).toLocaleDateString()}` : 'sans expiration'}
            </Text>
            <View style={styles.codeActions}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => shareWhatsApp(c)} disabled={!c.is_active}>
                <Text style={styles.actionIcon}>💬</Text>
                <Text style={styles.actionLabel}>WhatsApp</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => copyCode(c)}>
                <Text style={styles.actionIcon}>📋</Text>
                <Text style={styles.actionLabel}>Copier</Text>
              </TouchableOpacity>
              {c.is_active ? (
                <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={() => deactivate(c)}>
                  <Text style={styles.actionIcon}>⏻</Text>
                  <Text style={[styles.actionLabel, { color: '#DC2626' }]}>Désactiver</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.actionBtn, styles.actionDanger]} onPress={() => remove(c)}>
                  <Text style={styles.actionIcon}>🗑</Text>
                  <Text style={[styles.actionLabel, { color: '#DC2626' }]}>Supprimer</Text>
                </TouchableOpacity>
              )}
            </View>
          </Animated.View>
        ))}
      </Animated.View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20, paddingBottom: 60 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', padding: 32 },
  lockIcon: { fontSize: 48, marginBottom: 12 },
  lockTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  lockText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5 },
  sectionSub: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 12 },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFFFFF', borderRadius: 14, marginBottom: 8, shadowColor: '#0F172A', shadowOpacity: 0.04, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#94A3B8', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarAdmin: { backgroundColor: '#7C3AED' },
  avatarText: { color: '#FFF', fontWeight: '800', fontSize: 15 },
  memberName: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
  youTag: { color: '#2563EB', fontWeight: '600', fontSize: 12 },
  memberRole: { fontSize: 12, color: '#64748B', marginTop: 2, fontWeight: '600' },
  roleBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  roleBadgeAdmin: { backgroundColor: 'rgba(124,58,237,0.15)' },
  roleBadgeMember: { backgroundColor: 'rgba(37,99,235,0.12)' },
  roleBadgeText: { fontSize: 10, fontWeight: '900', letterSpacing: 1, color: '#1E293B' },
  generateWrap: { borderRadius: 14, overflow: 'hidden', marginBottom: 24, shadowColor: '#1E40AF', shadowOpacity: 0.4, shadowRadius: 18, shadowOffset: { width: 0, height: 10 } },
  generateBtn: { paddingVertical: 17, alignItems: 'center', borderRadius: 14 },
  generateText: { color: '#FFF', fontWeight: '900', letterSpacing: 1.5, fontSize: 13 },
  empty: { color: '#94A3B8', fontSize: 13, fontStyle: 'italic', paddingVertical: 12 },
  codeCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#10B981', shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },
  codeCardInactive: { borderLeftColor: '#CBD5E1', opacity: 0.7 },
  codeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  codeValue: { fontSize: 22, fontWeight: '900', color: '#0F172A', letterSpacing: 3, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace' },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  codeMeta: { fontSize: 12, color: '#64748B', marginTop: 6 },
  codeActions: { flexDirection: 'row', marginTop: 14, gap: 8 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 10, borderRadius: 10, backgroundColor: '#F1F5F9' },
  actionDanger: { backgroundColor: 'rgba(239,68,68,0.08)' },
  actionIcon: { fontSize: 14, marginRight: 6 },
  actionLabel: { fontSize: 12, fontWeight: '800', color: '#334155', letterSpacing: 0.5 },
});
