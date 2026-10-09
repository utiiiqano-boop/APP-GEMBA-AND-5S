import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
} from 'react-native-reanimated';
import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { listCompanyMembers, CompanyMember } from '../auditService';

export interface PlanningPayload {
  assigneeId: string;
  dueDate: string | null;
  pilot: string;
  comment: string;
}

interface Props {
  visible: boolean;
  companyId: string | null;
  onClose: () => void;
  onConfirm: (payload: PlanningPayload) => void;
  questionTitle: string;
  initial?: {
    assigneeId?: string | null;
    dueDate?: string | null;
    pilot?: string | null;
    comment?: string | null;
  };
}

export default function PlanningModal({
  visible,
  companyId,
  onClose,
  onConfirm,
  questionTitle,
  initial,
}: Props) {
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [pilot, setPilot] = useState('');
  const [comment, setComment] = useState('');

  const slide = useSharedValue(0);
  const backdrop = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      slide.value = withSpring(0, { damping: 20, stiffness: 120 });
      backdrop.value = withTiming(1, { duration: 220 });
      setSelected(initial?.assigneeId ?? null);
      setDueDate(initial?.dueDate ?? '');
      setPilot(initial?.pilot ?? '');
      setComment(initial?.comment ?? '');
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
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  };

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: slide.value }] }));
  const backdropStyle = useAnimatedStyle(() => ({ opacity: backdrop.value }));

  const confirm = () => {
    if (!selected) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onConfirm({
      assigneeId: selected,
      dueDate: dueDate.trim() || null,
      pilot: pilot.trim(),
      comment: comment.trim(),
    });
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>
        <TouchableOpacity style={{ flex: 1 }} onPress={onClose} />
      </Animated.View>
      <Animated.View style={[styles.sheet, sheetStyle]}>
        {Platform.OS !== 'web' && (
          <BlurView intensity={80} tint="light" style={StyleSheet.absoluteFill} />
        )}
        <View style={styles.handle} />
        <Text style={styles.title}>Planifier une action</Text>
        <Text style={styles.subtitle} numberOfLines={2}>{questionTitle}</Text>

        <Text style={styles.sectionLabel}>ASSIGNER À</Text>
        {loading ? (
          <ActivityIndicator color="#2563EB" style={{ marginVertical: 20 }} />
        ) : (
          <ScrollView style={styles.memberList} showsVerticalScrollIndicator={false}>
            {members.map((m) => {
              const active = selected === m.user_id;
              return (
                <TouchableOpacity
                  key={m.user_id}
                  style={[styles.memberRow, active && styles.memberRowActive]}
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
                    <Text style={[styles.memberName, active && styles.memberNameActive]}>
                      {m.full_name || m.email || 'Utilisateur'}
                    </Text>
                    <Text style={styles.memberRole}>{m.role}</Text>
                  </View>
                  {active && <View style={styles.checkDot} />}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        <Text style={styles.sectionLabel}>PILOTE (responsable)</Text>
        <TextInput
          value={pilot}
          onChangeText={setPilot}
          placeholder="Nom du pilote"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />

        <Text style={styles.sectionLabel}>DATE PRÉVUE DE RÉALISATION</Text>
        <TextInput
          value={dueDate}
          onChangeText={setDueDate}
          placeholder="AAAA-MM-JJ"
          placeholderTextColor="#94A3B8"
          style={styles.input}
        />

        <Text style={styles.sectionLabel}>INSTRUCTION (optionnel)</Text>
        <TextInput
          value={comment}
          onChangeText={setComment}
          placeholder="Détails de l'action à mener…"
          placeholderTextColor="#94A3B8"
          style={[styles.input, { height: 70 }]}
          multiline
        />

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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '90%',
    backgroundColor: 'rgba(255,255,255,0.97)',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    paddingBottom: 30,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: -8 },
  },
  handle: { alignSelf: 'center', width: 44, height: 4, borderRadius: 2, backgroundColor: '#CBD5E1', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: '#64748B', marginTop: 4, marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: '#94A3B8', letterSpacing: 2, marginTop: 12, marginBottom: 8 },
  memberList: { maxHeight: 180 },
  memberRow: { flexDirection: 'row', alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: '#F1F5F9', marginBottom: 8 },
  memberRowActive: { backgroundColor: 'rgba(37,99,235,0.12)' },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#94A3B8', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  avatarActive: { backgroundColor: '#2563EB' },
  avatarText: { color: '#FFF', fontWeight: '800' },
  memberName: { fontSize: 14, fontWeight: '700', color: '#334155' },
  memberNameActive: { color: '#2563EB' },
  memberRole: { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
  checkDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#2563EB' },
  input: { borderWidth: 1, borderColor: '#CBD5E1', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#0F172A' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' },
  cancelText: { color: '#475569', fontWeight: '800', letterSpacing: 1 },
  confirmBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  confirmGrad: { paddingVertical: 14, alignItems: 'center' },
  confirmText: { color: '#FFF', fontWeight: '800', letterSpacing: 1 },
});
