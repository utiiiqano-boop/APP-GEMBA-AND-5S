import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Buffer pour afficher les logs dans l'UI
export const pushLogs: string[] = [];
function log(msg: string, ...args: any[]) {
  const full = args.length
    ? msg + ' ' + args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')
    : msg;
  // eslint-disable-next-line no-console
  console.log(full);
  pushLogs.push(full);
  if (pushLogs.length > 100) pushLogs.shift();
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushToken(): Promise<string | null> {
  pushLogs.length = 0;
  try {
    log('[push] === START ===');
    log('[push] Platform:', Platform.OS);
    log('[push] isDevice:', String(Device.isDevice));

    if (Platform.OS === 'web') {
      log('[push] WEB détecté — skip');
      return null;
    }

    if (!Device.isDevice) {
      log('[push] ÉMULATEUR détecté — skip');
      return null;
    }

    const perm = await Notifications.getPermissionsAsync();
    log('[push] Permission actuelle:', perm.status);

    let finalStatus = perm.status;
    if (finalStatus !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      finalStatus = req.status;
      log('[push] Nouvelle permission:', finalStatus);
    }

    if (finalStatus !== 'granted') {
      log('[push] PERMISSION REFUSÉE');
      return null;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications GEMBA',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
      log('[push] Canal Android créé');
    }

    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    log('[push] projectId:', projectId);
    if (!projectId) {
      log('[push] PROJECTID MANQUANT');
      return null;
    }

    log('[push] Génération du token...');
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    log('[push] ✅ TOKEN:', token);

    const { data: u } = await supabase.auth.getUser();
    if (!u.user) {
      log('[push] PAS DE USER CONNECTÉ');
      return null;
    }
    log('[push] User:', u.user.id);

    log('[push] Upsert dans Supabase...');
    const { error } = await supabase.from('push_tokens').upsert(
      {
        user_id: u.user.id,
        token,
        platform: Platform.OS,
        is_active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    );

    if (error) {
      log('[push] ERREUR UPSERT:', error.message, error.code);
      return null;
    }

    log('[push] ✅ ENREGISTRÉ DANS SUPABASE');
    return token;
  } catch (e: any) {
    log('[push] EXCEPTION:', e?.message ?? String(e));
    return null;
  }
}

export async function unregisterPushToken() {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) return;
    const t = await Notifications.getExpoPushTokenAsync({ projectId }).catch(() => null);
    if (!t) return;
    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', u.user.id)
      .eq('token', t.data);
  } catch {}
}

export function subscribeToNotificationTaps(
  onTap: (d: Record<string, any>) => void
) {
  const sub = Notifications.addNotificationResponseReceivedListener((r) => {
    onTap(r.notification.request.content.data as Record<string, any>);
  });
  return () => sub.remove();
}
