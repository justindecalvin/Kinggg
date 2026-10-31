import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const CONFIG_URL_KEY = 'stanbax_supabase_url';
const CONFIG_ANON_KEY = 'stanbax_supabase_anon_key';
const SESSION_KEYS = ['stanbax_db_session'];
const COMMUNITY_KEYS = new Set([
  'stanbax_chat_channels',
  'stanbax_chat_messages',
  'stanbax_parent_consultations',
  'stanbax_school_rep_config',
]);
const PUBLIC_REALTIME_KEYS = [
  'stanbax_chat_channels',
  'stanbax_chat_messages',
  'stanbax_visitor_conversations',
  'stanbax_chat_typing',
  'stanbax_school_rep_config',
];
const PRIVATE_POLL_KEYS = [
  'stanbax_parent_consultations',
  'stanbax_chat_read_timestamps',
];
const VISITOR_KEY = 'stanbax_visitor_conversations';
const VISITOR_TOKEN_KEY = 'stanbax_visitor_chat_access_tokens';
const TYPING_KEY = 'stanbax_chat_typing';
const MIN_PUBLIC_MESSAGE_INTERVAL_MS = 120;

type ChatRecord = Record<string, any>;

const readSessionToken = (): string | null => {
  try {
    for (const key of SESSION_KEYS) {
      const value = localStorage.getItem(key) || sessionStorage.getItem(key);
      if (value) return value;
    }
  } catch {}
  return null;
};

const parseJson = (value: string | null): any => {
  if (!value) return null;
  try { return JSON.parse(value); } catch { return null; }
};

const sameJson = (a: unknown, b: unknown): boolean => {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch { return false; }
};

const rowsAsArray = (value: unknown): ChatRecord[] => Array.isArray(value)
  ? value.filter((item): item is ChatRecord => Boolean(item) && typeof item === 'object')
  : [];

const sendStateEvent = (key: string, data: unknown): void => {
  try {
    window.dispatchEvent(new CustomEvent('stanbax-state-change', {
      detail: { key, data, timestamp: Date.now(), source: 'supabase-realtime' },
    }));
  } catch {}
};

const warnOnce = (() => {
  const seen = new Set<string>();
  return (key: string, message: string): void => {
    if (seen.has(key)) return;
    seen.add(key);
    console.warn(`[Supabase Chat] ${message}`);
  };
})();

let noticeTimer = 0;
const showChatSyncError = (message: string): void => {
  try {
    let notice = document.getElementById('stanbax-chat-sync-notice');
    if (!notice) {
      notice = document.createElement('div');
      notice.id = 'stanbax-chat-sync-notice';
      notice.setAttribute('role', 'status');
      notice.style.cssText = 'position:fixed;z-index:2147483000;left:50%;bottom:calc(92px + env(safe-area-inset-bottom, 0px));transform:translateX(-50%);width:min(92vw,440px);box-sizing:border-box;padding:12px 16px;border-radius:14px;background:#7f1d1d;color:#fff;box-shadow:0 8px 28px #0005;font:600 14px/1.45 system-ui,sans-serif;text-align:center;';
      document.body.appendChild(notice);
    }
    notice.textContent = message;
    window.clearTimeout(noticeTimer);
    noticeTimer = window.setTimeout(() => notice?.remove(), 8_000);
  } catch {}
};

const createAuthedFetch = (): typeof fetch => async (input, init) => {
  const headers = new Headers(init?.headers);
  const token = readSessionToken();
  if (token) headers.set('x-stanbax-session', token);
  return fetch(input, { ...init, headers });
};

const installBridge = (client: SupabaseClient, startedAt: number): void => {
  if ((window as any).__stanbaxChatRealtimeInstalled) return;
  (window as any).__stanbaxChatRealtimeInstalled = true;

  let applyingRemote = false;
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  const localSnapshots = new Map<string, string | null>();
  const recentLocalChanges = new Map<string, number>();
  const queued = new Map<string, { value: string; previous: string | null }>();
  const flushTimers = new Map<string, number>();
  const lastPublicMessageSentAt = new Map<string, number>();

  const getVisitorAccessToken = (visitorId: string): string => {
    const tokens = parseJson(localStorage.getItem(VISITOR_TOKEN_KEY)) || {};
    if (typeof tokens[visitorId] === 'string' && tokens[visitorId].length >= 32) return tokens[visitorId];
    if (!globalThis.crypto?.getRandomValues) throw new Error('Secure browser randomness is unavailable.');
    const bytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(bytes);
    const token = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
    originalSetItem(VISITOR_TOKEN_KEY, JSON.stringify({ ...tokens, [visitorId]: token }));
    return token;
  };

  for (const key of [...COMMUNITY_KEYS, VISITOR_KEY, TYPING_KEY, ...PRIVATE_POLL_KEYS]) {
    localSnapshots.set(key, localStorage.getItem(key));
  }

  const persistState = async (key: string, value: string, previous: string | null): Promise<void> => {
    const data = parseJson(value);
    if (data === null || data === undefined) return;
    const token = readSessionToken();

    if (key === VISITOR_KEY) {
      if (token) {
        const { error, data: result } = await client.rpc('merge_authenticated_visitor_conversations', {
          p_conversations: rowsAsArray(data),
        });
        if (!error && result?.ok !== false) return;
        if (error && !/access denied|not signed in/i.test(error.message || '')) {
          warnOnce('visitor-admin-merge', `Could not save the authenticated visitor-chat update: ${error.message}`);
        }
      }

      // Anonymous landing-page visitors may append only visitor-authored messages.
      const oldConversations = rowsAsArray(parseJson(previous));
      const oldIds = new Set(oldConversations.flatMap(conversation =>
        rowsAsArray(conversation.messages).map(message => String(message.id || ''))
      ));
      for (const conversation of rowsAsArray(data)) {
        const visitorId = String(conversation.visitorId || '');
        if (!visitorId) continue;
        for (const message of rowsAsArray(conversation.messages)) {
          const messageId = String(message.id || '');
          const timestamp = Date.parse(String(message.timestamp || ''));
          if (
            !messageId || oldIds.has(messageId) || message.sender !== 'visitor' ||
            !Number.isFinite(timestamp) || timestamp < startedAt - 2_000
          ) continue;
          const now = Date.now();
          if (now - (lastPublicMessageSentAt.get(visitorId) || 0) < MIN_PUBLIC_MESSAGE_INTERVAL_MS) continue;
          lastPublicMessageSentAt.set(visitorId, now);
          const { error, data: result } = await client.rpc('submit_public_visitor_chat_message', {
            p_visitor_id: visitorId,
            p_access_token: getVisitorAccessToken(visitorId),
            p_message: message,
            p_visitor_info: {
              name: conversation.visitorName || message.senderName || 'Visitor',
              phone: conversation.visitorPhone || null,
              email: conversation.visitorEmail || null,
              category: conversation.visitorCategory || null,
            },
          });
          if (error) {
            warnOnce('visitor-public-message', `A visitor message could not be stored in Supabase: ${error.message}`);
            showChatSyncError('Your message could not be delivered online. Please try again.');
          } else if (result?.ok === false) {
            warnOnce('visitor-public-message-denied', `Visitor chat was not accepted: ${result.message || 'access denied'}`);
            showChatSyncError(result.message || 'Your message could not be delivered online. Please try again.');
          }
        }
      }
      return;
    }

    if (key === TYPING_KEY) {
      const before = parseJson(previous) || {};
      const after = data && typeof data === 'object' ? data as Record<string, ChatRecord> : {};
      for (const [visitorId, next] of Object.entries(after)) {
        if (!next || typeof next !== 'object') continue;
        const old = before[visitorId] || {};
        for (const sender of ['visitor', 'representative'] as const) {
          const flag = sender === 'visitor' ? 'isVisitorTyping' : 'isRepTyping';
          const nameKey = sender === 'visitor' ? 'visitorName' : 'repName';
          if (old[flag] === next[flag] && old[nameKey] === next[nameKey]) continue;
          if (sender === 'representative' && !token) continue;
          const { error } = await client.rpc('sync_chat_typing_status', {
            p_visitor_id: visitorId,
            p_sender: sender,
            p_is_typing: Boolean(next[flag]),
            p_sender_name: String(next[nameKey] || (sender === 'visitor' ? 'Visitor' : 'School representative')),
          });
          if (error) warnOnce(`typing-${sender}`, `Could not sync ${sender} typing status: ${error.message}`);
        }
      }
      return;
    }

    if (!token) return;
    if (key === 'stanbax_chat_read_timestamps') {
      const before = parseJson(previous) || {};
      if (!data || typeof data !== 'object' || Array.isArray(data)) return;
      for (const [userKey, userData] of Object.entries(data)) {
        if (sameJson(before[userKey], userData)) continue;
        const { error } = await client.rpc('sync_chat_read_receipt', {
          p_user_key: userKey,
          p_user_data: userData,
        });
        if (error) warnOnce('read-receipts', `Could not sync chat read receipts: ${error.message}`);
      }
      return;
    }
    if (COMMUNITY_KEYS.has(key)) {
      const { error } = await client.rpc('put_states', { p_items: [{ key, data }] });
      if (error) {
        warnOnce(`state-${key}`, `Could not sync ${key}: ${error.message}`);
        showChatSyncError('Chat updates could not be saved online. Please try again.');
      }
    }
  };

  const enqueueState = (key: string, value: string, previous: string | null): void => {
    const earlier = queued.get(key);
    queued.set(key, { value, previous: earlier ? earlier.previous : previous });
    const existingTimer = flushTimers.get(key);
    if (existingTimer) window.clearTimeout(existingTimer);
    const timer = window.setTimeout(() => {
      flushTimers.delete(key);
      const item = queued.get(key);
      queued.delete(key);
      if (item) {
        void persistState(key, item.value, item.previous).catch(error => {
          warnOnce(`persist-${key}`, `Could not send ${key} to Supabase: ${String(error)}`);
          showChatSyncError('Chat updates could not be saved online. Please try again.');
        });
      }
    }, 80);
    flushTimers.set(key, timer);
  };

  localStorage.setItem = (key: string, value: string): void => {
    const previous = localStorage.getItem(key);
    originalSetItem(key, value);
    if (key === VISITOR_KEY || COMMUNITY_KEYS.has(key) || key === TYPING_KEY || PRIVATE_POLL_KEYS.includes(key)) {
      localSnapshots.set(key, value);
      if (!applyingRemote && previous !== value) {
        recentLocalChanges.set(key, Date.now());
        enqueueState(key, value, previous);
      }
    }
  };

  localStorage.removeItem = (key: string): void => {
    const previous = localStorage.getItem(key);
    originalRemoveItem(key);
    localSnapshots.set(key, null);
    // Chat history removal is an explicit admin operation; do not issue an unrestricted database delete.
    if (previous && key === VISITOR_KEY && readSessionToken()) {
      warnOnce('visitor-delete', 'Local visitor-chat removal is not mirrored as a database delete. Use the admin conversation controls.');
    }
  };

  const applyRemoteRow = (row: any): void => {
    if (!row || typeof row.key !== 'string' || !PUBLIC_REALTIME_KEYS.includes(row.key)) return;
    const key = row.key;
    const data = row.data;
    const value = JSON.stringify(data);
    if (localStorage.getItem(key) === value) return;
    if (Date.now() - (recentLocalChanges.get(key) || 0) < 4_000) return;
    applyingRemote = true;
    try {
      const oldValue = localStorage.getItem(key);
      originalSetItem(key, value);
      localSnapshots.set(key, value);
      window.dispatchEvent(new StorageEvent('storage', {
        key, oldValue, newValue: value, storageArea: localStorage, url: window.location.href,
      }));
      sendStateEvent(key, data);
    } finally {
      applyingRemote = false;
    }
  };

  const channel = client.channel('stanbax-public-chat-live');
  for (const key of PUBLIC_REALTIME_KEYS) {
    channel.on('postgres_changes', {
      event: '*', schema: 'public', table: 'school_state', filter: `key=eq.${key}`,
    }, payload => {
      if (payload.eventType === 'DELETE') return;
      applyRemoteRow(payload.new);
    });
  }
  channel.subscribe(status => {
    if (status === 'SUBSCRIBED') console.info('[Supabase Chat] Realtime chat updates connected.');
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      warnOnce('realtime', 'Realtime is unavailable; the shared-state polling fallback remains active.');
    }
  });

  let pollBusy = false;
  const pollState = async (): Promise<void> => {
    if (pollBusy || document.visibilityState === 'hidden') return;
    pollBusy = true;
    try {
      const keys = [...PUBLIC_REALTIME_KEYS, ...PRIVATE_POLL_KEYS];
      const { data, error } = await client.from('school_state').select('key,data').in('key', keys);
      if (error) {
        if (readSessionToken()) warnOnce('poll', `Chat sync check failed: ${error.message}`);
        return;
      }
      for (const row of data || []) {
        if (PUBLIC_REALTIME_KEYS.includes(row.key)) {
          applyRemoteRow(row);
        } else if (readSessionToken() && PRIVATE_POLL_KEYS.includes(row.key)) {
          const value = JSON.stringify(row.data);
          if (localStorage.getItem(row.key) === value || Date.now() - (recentLocalChanges.get(row.key) || 0) < 4_000) continue;
          applyingRemote = true;
          try {
            const oldValue = localStorage.getItem(row.key);
            originalSetItem(row.key, value);
            localSnapshots.set(row.key, value);
            window.dispatchEvent(new StorageEvent('storage', {
              key: row.key, oldValue, newValue: value, storageArea: localStorage, url: window.location.href,
            }));
            sendStateEvent(row.key, row.data);
          } finally {
            applyingRemote = false;
          }
        }
      }
    } catch (error) {
      warnOnce('poll-exception', `Chat sync check failed: ${String(error)}`);
    } finally {
      pollBusy = false;
    }
  };

  void pollState();
  window.setInterval(() => { void pollState(); }, 4_000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void pollState();
  });
};

export const startChatRealtimeBridge = async (): Promise<void> => {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  const startedAt = Date.now();
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const url = String(localStorage.getItem(CONFIG_URL_KEY) || '').trim().replace(/\/+$/, '');
    const anonKey = String(localStorage.getItem(CONFIG_ANON_KEY) || '').trim();
    if (url && anonKey) {
      try {
        const client = createClient(url, anonKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: { fetch: createAuthedFetch() },
        });
        installBridge(client, startedAt);
      } catch (error) {
        warnOnce('client-init', `Could not start the realtime bridge: ${String(error)}`);
      }
      return;
    }
    await new Promise(resolve => window.setTimeout(resolve, 500));
  }
  warnOnce('no-config', 'Supabase chat sync is disabled until a Supabase URL and anon key are configured.');
  showChatSyncError('Chat sync is unavailable. Please contact the school office.');
};

void startChatRealtimeBridge();
