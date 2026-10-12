import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configuration d'affichage en foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Enregistre le token Expo Push pour l'utilisateur courant.
 * À appeler après login et à chaque démarrage de l'app.
 */
export async function registerPushToken(): Promise<string | null> {
  try {
    // Simulateur : pas de token
    if (!Device.isDevice) {
      console.log('[push] Simulateur — pas de token');
      return null;
    }

    // Permissions
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;
    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      console.log('[push] Permission refusée');
      return null;
    }

    // Canal Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Notifications GEMBA',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#2563EB',
      });
    }

    // Token
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
      console.warn('[push] projectId manquant dans app.json');
      return null;
    }

    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    const token = tokenData.data;
    console.log('[push] token =', token);

    // Récupère l'utilisateur
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return null;

    // Upsert dans Supabase
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

    if (error) console.warn('[push] upsert error', error);

    return token;
  } catch (e: any) {
    console.warn('[push] register error', e?.message);
    return null;
  }
}

/** Désenregistre le token au logout. */
export async function unregisterPushToken() {
  try {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    }).catch(() => null);
    if (!tokenData) return;
    await supabase
      .from('push_tokens')
      .update({ is_active: false })
      .eq('user_id', u.user.id)
      .eq('token', tokenData.data);
  } catch {
    // ignore
  }
}

/** Écoute les taps sur les notifications. */
export function subscribeToNotificationTaps(
  onTap: (data: Record<string, any>) => void
) {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data;
    onTap(data as Record<string, any>);
  });
  return () => sub.remove();
}
