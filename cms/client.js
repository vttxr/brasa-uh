import { config } from './config.js';
let publicPromise, adminPromise;
async function makeClient(admin) {
  const { createClient } = await import('./vendor/supabase.js');
  return createClient(config.url, config.publishableKey, {
    auth: {
      persistSession: admin,
      autoRefreshToken: admin,
      detectSessionInUrl: false,
      storageKey: admin ? 'brasa-uh-admin-auth' : 'brasa-uh-public-anonymous',
    },
    global: { fetch: (input, init = {}) => fetch(input, {
      ...init, signal: init.signal || AbortSignal.timeout(config.timeoutMs),
    }) },
  });
}
// The public client never restores an administrator session or reads draft rows.
export function getPublicClient() { return publicPromise ||= makeClient(false); }
export function getAdminClient() { return adminPromise ||= makeClient(true); }
