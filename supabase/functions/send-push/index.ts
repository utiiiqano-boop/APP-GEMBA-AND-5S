// Pas d'import npm — on utilise fetch directement pour éviter le bundling réseau

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const EXPO_TOKEN = Deno.env.get('EXPO_ACCESS_TOKEN') ?? '';

interface WebhookPayload {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  schema: string;
  record: {
    id: string;
    user_id: string;
    title: string;
    body: string;
    data?: Record<string, any>;
  };
  old_record: null | any;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    console.log('[send-push] type =', payload.type, 'table =', payload.table);

    if (payload.type !== 'INSERT' || payload.table !== 'notifications') {
      return new Response(JSON.stringify({ ok: true, ignored: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = payload.record.user_id;

    // Récupère les push tokens via REST
    const tokenUrl = `${SUPABASE_URL}/rest/v1/push_tokens?user_id=eq.${userId}&is_active=eq.true&select=token`;
    const tokenRes = await fetch(tokenUrl, {
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
    });

    if (!tokenRes.ok) {
      const text = await tokenRes.text();
      console.error('[send-push] token fetch failed', tokenRes.status, text);
      return new Response(JSON.stringify({ error: text }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokens: { token: string }[] = await tokenRes.json();
    console.log('[send-push] tokens found =', tokens.length);

    if (tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Envoi via Expo Push API
    const messages = tokens.map((t) => ({
      to: t.token,
      sound: 'default',
      title: payload.record.title,
      body: payload.record.body,
      data: payload.record.data ?? {},
      channelId: 'default',
      priority: 'high',
    }));

    const pushRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        Accept_encoding: 'gzip, deflate',
        Authorization: `Bearer ${EXPO_TOKEN}`,
      },
      body: JSON.stringify(messages),
    });

    const result = await pushRes.json();
    console.log('[send-push] expo response', JSON.stringify(result));

    return new Response(JSON.stringify({ sent: messages.length, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e: any) {
    console.error('[send-push] error', e?.message ?? String(e));
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
