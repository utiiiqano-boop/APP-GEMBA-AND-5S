import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Image,
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '../../features/auth/AuthProvider';
import { getMyRole, Role } from '../../features/audit/auditService';
import {
  getMyCompany, updateCompanyName, updateCompanyLogo,
  removeCompanyLogo, Company,
} from '../../lib/companyService';

export default function SettingsScreen() {
  const { user } = useAuth();
  const [role, setRole] = useState<Role>('member');
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [nameDraft, setNameDraft] = useState('');
  const [editingName, setEditingName] = useState(false);

  const isAdmin = role === 'owner' || role === 'admin';

  const load = useCallback(async () => {
    try {
      const c = await getMyCompany();
      console.log('[settings] company =', c);
      setCompany(c);
      if (c) {
        setNameDraft(c.name);
        const r = await getMyRole(c.id);
        setRole(r);
      }
    } catch (e: any) {
      console.error('[settings] load error', e);
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
      (async () => { await load(); })();
    }, [load])
  );

  /* ─── Change name ─── */

  const saveName = async () => {
    if (!company) return;
    const trimmed = nameDraft.trim();
    if (!trimmed) {
      Alert.alert('Erreur', 'Le nom ne peut pas être vide.');
      return;
    }
    if (trimmed === company.name) {
      setEditingName(false);
      return;
    }
    setBusy(true);
    try {
      await updateCompanyName(company.id, trimmed);
      setCompany({ ...company, name: trimmed });
      setEditingName(false);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('OK', 'Nom modifié.');
    } catch (e: any) {
      Alert.alert('Erreur', e.message);
    } finally {
      setBusy(false);
    }
  };

  /* ─── Change logo ─── */

  const pickLogo = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission requise', 'Autorisez l\'accès aux photos.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (res.canceled || !res.assets[0]) return;
    await uploadLogo(res.assets[0].uri);
  };

  const uploadLogo = async (uri: string) => {
    if (!company) return;
    setBusy(true);
    try {
      const url = await updateCompanyLogo(company.id, uri);
      setCompany({ ...company, logo_url: url });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('OK', 'Logo mis à jour.');
    } catch (e: any) {
      Alert.alert('Erreur upload', e.message);
    } finally {
      setBusy(false);
    }
  };

  const removeLogo = () => {
    if (!company) return;
    Alert.alert('Supprimer le logo ?', 'Le logo sera retiré.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await removeCompanyLogo(company.id);
            setCompany({ ...company, logo_url: null });
          } catch (e: any) {
            Alert.alert('Erreur', e.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  /* ─── Render ─── */

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#2563EB" size="large" />
      </View>
    );
  }

  if (!company) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyIcon}>🏢</Text>
        <Text style={styles.emptyTitle}>Aucune entreprise</Text>
        <Text style={styles.emptyText}>
          Rejoignez ou créez une entreprise pour accéder aux paramètres.
        </Text>
      </View>
    );
  }

  if (!isAdmin) {
    return (
      <View style={styles.center}>
        <Text style={styles.lockIcon}>🔒</Text>
        <Text style={styles.lockTitle}>Accès réservé</Text>
        <Text style={styles.lockText}>
          Seuls les administrateurs peuvent modifier la configuration.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.pageTitle}>Configuration Entreprise</Text>
        <Text style={styles.pageSub}>
          Modifiez le nom et le logo de votre entreprise.
        </Text>

        {/* Logo card */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.card}>
          <Text style={styles.sectionLabel}>LOGO DE L'ENTREPRISE</Text>

          <View style={styles.logoWrap}>
            <TouchableOpacity
              onPress={pickLogo}
              activeOpacity={0.85}
              disabled={busy}
            >
              <LinearGradient
                colors={company.logo_url ? ['#10B981', '#059669'] : ['#3B82F6', '#2563EB']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.logoCircle}
              >
                {company.logo_url ? (
                  <Image
                    source={{ uri: company.logo_url }}
                    style={styles.logoImage}
                  />
                ) : (
                  <Text style={styles.logoPlus}>+</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <Text style={styles.logoHint}>
              {company.logo_url
                ? 'Touchez pour changer'
                : 'Touchez pour ajouter un logo'}
            </Text>
          </View>

          <View style={styles.logoActions}>
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={pickLogo}
              disabled={busy}
            >
              <Text style={styles.actionBtnText}>
                {company.logo_url ? '🔄 Changer' : '📷 Ajouter'}
              </Text>
            </TouchableOpacity>

            {company.logo_url && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionDanger]}
                onPress={removeLogo}
                disabled={busy}
              >
                <Text style={[styles.actionBtnText, { color: '#DC2626' }]}>
                  🗑 Supprimer
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* Name card */}
        <Animated.View
          entering={FadeInDown.delay(100).duration(400)}
          style={styles.card}
        >
          <Text style={styles.sectionLabel}>NOM DE L'ENTREPRISE</Text>

          {editingName ? (
            <>
              <TextInput
                value={nameDraft}
                onChangeText={setNameDraft}
                placeholder="Nom de l'entreprise"
                placeholderTextColor="#94A3B8"
                style={styles.input}
                autoFocus
                editable={!busy}
              />
              <View style={styles.editActions}>
                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: '#F1F5F9' }]}
                  onPress={() => {
                    setNameDraft(company.name);
                    setEditingName(false);
                  }}
                  disabled={busy}
                >
                  <Text style={{ color: '#475569', fontWeight: '800' }}>
                    Annuler
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.editBtn, { backgroundColor: '#2563EB' }]}
                  onPress={saveName}
                  disabled={busy}
                >
                  {busy ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={{ color: '#FFF', fontWeight: '800' }}>
                      Enregistrer
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          ) : (
            <>
              <View style={styles.nameBox}>
                <Text style={styles.nameValue}>{company.name}</Text>
              </View>
              <TouchableOpacity
                style={styles.editNameBtn}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setEditingName(true);
                }}
              >
                <Text style={styles.editNameText}>✎ Modifier le nom</Text>
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* Info card */}
        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.card}
        >
          <Text style={styles.sectionLabel}>INFORMATIONS</Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {company.id.slice(0, 8)}…
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>PROPRIÉTAIRE</Text>
            <Text style={styles.infoValue} numberOfLines={1}>
              {user?.email}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>CRÉÉE LE</Text>
            <Text style={styles.infoValue}>
              {new Date(company.created_at).toLocaleDateString()}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>RÔLE</Text>
            <Text style={[styles.infoValue, styles.roleValue]}>
              {role.toUpperCase()}
            </Text>
          </View>
        </Animated.View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F8FAFC' },
  scroll: { padding: 20 },
  center: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    padding: 32, backgroundColor: '#F8FAFC',
  },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  emptyText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8 },
  lockIcon: { fontSize: 48, marginBottom: 12 },
  lockTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  lockText: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8 },
  pageTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  pageSub: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 20 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 2,
    marginBottom: 16,
  },

  /* Logo */
  logoWrap: { alignItems: 'center', marginBottom: 20 },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.4,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    overflow: 'hidden',
  },
  logoImage: { width: 120, height: 120, borderRadius: 60 },
  logoPlus: {
    fontSize: 56,
    color: '#FFFFFF',
    fontWeight: '300',
    lineHeight: 60,
  },
  logoHint: {
    marginTop: 12,
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  logoActions: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
  },
  actionDanger: { backgroundColor: 'rgba(239,68,68,0.1)' },
  actionBtnText: { fontWeight: '800', fontSize: 13, color: '#2563EB' },

  /* Name */
  nameBox: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  nameValue: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
  editNameBtn: {
    paddingVertical: 12,
    backgroundColor: 'rgba(37,99,235,0.1)',
    borderRadius: 10,
    alignItems: 'center',
  },
  editNameText: { color: '#2563EB', fontWeight: '800', fontSize: 13 },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
    color: '#0F172A',
  },
  editActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  editBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center' },

  /* Info */
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  infoLabel: {
    fontSize: 11,
    fontWeight: '900',
    color: '#94A3B8',
    letterSpacing: 1.5,
  },
  infoValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
    flex: 1,
    textAlign: 'right',
    marginLeft: 12,
  },
  roleValue: { color: '#7C3AED' },
});
