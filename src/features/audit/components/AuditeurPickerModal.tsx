import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, ActivityIndicator,
} from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSpring, Easing } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { listCompanyMembers, CompanyMember } from '../auditService';

interface Props {
  visible: boolean;
  companyId: string | null;
  currentAuditeurId: string | null;
  onClose: () => void;
  onConfirm: (auditeurId: string) => void;
}

export default function AuditeurPickerModal({
  visible,
  companyId,
  currentAuditeurId,
  onClose,
  onConfirm,
}: Props) {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  const slide = useSharedValue(0);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      slide.value = withSpring(0, { damping: 20, stiffness: 120 });
      backdrop.value = withTiming(1, { duration: 220 });
      setSelected(currentAuditeurId);
      load();
    } else {
      slide.value = withTiming(500, { duration: 220, easing: Easing.in(Easing.cubic) });
      backdrop.value = withTiming(0, { duration: 220 });
    }
  }, [visible]);

  const load = async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const m = await listCompanyMembers(companyId);
      setMembers(m);
    } catch (e) { console.warn(e); }
    finally { setLoading(false); }
  };

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slide.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const confirm = () => {
    if (!selected) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm(selected);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, sheetStyle]}>
        <View style={styles.handle} />
        <Text style={styles.title}>Choisir l'auditeur</Text>
        <Text style={styles.subtitle}>
          Cette personne verra toutes les questions et répondra.
        </Text>

        {loading ? (
          <ActivityIndicator color="#2563EB" style={{ marginVertical: 30 }} />
        ) : (
          <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
            {members.map((m) => {
              const active = selected === m.user_id;
              return (
                <TouchableOpacity
                  key={m.user_id}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => {
                    Haptics.selectionAsync();
                    setSelected(m.user_id);
                  }}
                >
                  <View style={[styles.avatar, active && styles.avatarActive]}>
                    <Text style={styles.avatarText}>
                      {m.full_name?.[0]?.toUpperCase() ?? m.email?.[0]?.toUpperCase() ?? '?'}
                    </Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, active && styles.nameActive]}>
                      {m.full_name || m.email}
                    </Text>
                    <Text style={styles.role}>{m.role}</Text>
                  </View>
                  {active && <View style={styles.dot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <View style={styles.actions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelText}>Annuler</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={confirm} disabled={!selected}>
            <LinearGradient
              colors={['#3B82F6', '#2563EB']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.confirmGrad}
            >
              <Text style={styles.confirmText}>Enregistrer</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(15,23,42,0.4)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    maxHeight: '88%', backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26, borderTopRightRadius: 26,
    padding: 20, paddingBottom: 30,
  },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A' },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },
  row: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', marginBottom: 8 },
  rowActive: { backgroundColor: 'rgba(37,99,235,0.12)' },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#94A3B8', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarActive: { backgroundColor: '#2563EB' },
  avatarText: { color: '#FFF', fontWeight: '800' },
  name: { fontSize: 14, fontWeight: '700', color: '#334155' },
  nameActive: { color: '#2563EB' },
  role: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelText: { color: '#475569', fontWeight: '800' },
  confirmBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  confirmGrad: { paddingVertical: 14, alignItems: 'center' },
  confirmText: { color: '#FFF', fontWeight: '800' },
});
