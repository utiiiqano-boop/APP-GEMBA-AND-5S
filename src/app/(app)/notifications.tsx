import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { colors, font, radius, shadow, spacing } from '../../theme';

interface Notif {
  id: string;
  title: string;
  body: string;
  read: boolean;
  data: any;
  created_at: string;
}

export default function NotificationsScreen() {
  const [items, setItems] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', u.user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    if (!error && data) setItems(data as Notif[]);
  }, []);

  useEffect(() => { (async () => { await load(); setLoading(false); })(); }, [load]);
  useFocusEffect(useCallback(() => { (async () => { await load(); })(); }, [load]));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const markAllRead = async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    await supabase.from('notifications').update({ read: true }).eq('user_id', u.user.id);
    await load();
  };

  if (loading) return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Notifications</Text>
          <Text style={styles.sub}>{items.filter((i) => !i.read).length} non lues</Text>
        </View>
        {items.some((i) => !i.read) && (
          <TouchableOpacity style={styles.markBtn} onPress={markAllRead}>
            <Text style={styles.markText}>Tout lire</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
        {items.length === 0 && (
          <View style={styles.empty}>
            <Feather name="bell-off" size={40} color={colors.gray[400]} />
            <Text style={styles.emptyTitle}>Aucune notification</Text>
          </View>
        )}

        {items.map((n) => (
          <View key={n.id} style={[styles.card, !n.read && styles.cardUnread]}>
            <View style={[styles.iconWrap, { backgroundColor: n.data?.type === 'nok' ? colors.dangerSoft : colors.primarySoft }]}>
              <Feather
                name={n.data?.type === 'nok' ? 'alert-triangle' : 'clipboard'}
                size={16}
                color={n.data?.type === 'nok' ? colors.danger : colors.primary}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{n.title}</Text>
              <Text style={styles.cardBody}>{n.body}</Text>
              <Text style={styles.cardDate}>{new Date(n.created_at).toLocaleString()}</Text>
            </View>
            {!n.read && <View style={styles.unreadDot} />}
          </View>
        ))}
        <View style={{ height: 40 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.gray[50] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.xl, backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.gray[200] },
  title: { fontSize: 22, fontFamily: font.black, color: colors.gray[900] },
  sub: { fontSize: 12, fontFamily: font.medium, color: colors.gray[500], marginTop: 2 },
  markBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.sm, backgroundColor: colors.primarySoft },
  markText: { color: colors.primary, fontFamily: font.bold, fontSize: 12 },
  scroll: { padding: spacing.lg },
  empty: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  emptyTitle: { fontSize: 16, fontFamily: font.bold, color: colors.gray[500] },
  card: { flexDirection: 'row', gap: 12, backgroundColor: colors.white, borderRadius: radius.lg, padding: spacing.lg, marginBottom: spacing.md, ...shadow.sm },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: colors.primary },
  iconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 14, fontFamily: font.bold, color: colors.gray[900] },
  cardBody: { fontSize: 12, fontFamily: font.regular, color: colors.gray[600], marginTop: 4, lineHeight: 17 },
  cardDate: { fontSize: 10, fontFamily: font.medium, color: colors.gray[400], marginTop: 6 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
