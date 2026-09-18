import { api } from './tauriBridge';
import { SubscriptionInfo, UserProfile } from '../types';
import { generateChallenge, generateState, generateVerifier } from './pkce';

// All backend calls (token exchange/refresh, subscriptions, user, revoke) happen in Rust
// (see src-tauri/src/auth.rs) rather than via fetch() here: dash.novalink.lk sends no
// Access-Control-Allow-Origin header, so the webview's CORS enforcement blocks a
// browser-side fetch() before it ever sees the response. Rust's HTTP client isn't a
// browser and isn't subject to CORS.

export class SessionExpiredError extends Error {
  constructor() {
    super('Session expired, please sign in again.');
  }
}

export interface PendingLogin {
  verifier: string;
  state: string;
}

/** Opens the system browser to the NetchSuite authorize page. Caller must keep the returned verifier/state to complete the flow. */
export async function startLogin(): Promise<PendingLogin> {
  const verifier = generateVerifier();
  const state = generateState();
  const challenge = await generateChallenge(verifier);

  const url = await api.oauthAuthorizeUrl(challenge, state);
  await api.openUrl(url);
  return { verifier, state };
}

/** Exchanges the deep-link auth code for tokens (stored securely by Rust). */
export async function completeLogin(code: string, verifier: string): Promise<void> {
  try {
    await api.oauthExchangeCode(code, verifier);
  } catch (err) {
    throw new Error(err instanceof Error ? err.message : String(err));
  }
}

/** Cheap local check (no network) for whether a session exists. */
export function hasStoredSession(): Promise<boolean> {
  return api.oauthHasSession();
}

function toSessionError(err: unknown): Error {
  // Tauri rejects a Result::Err(String) with the raw string itself, not an Error instance.
  const message = err instanceof Error ? err.message : String(err);
  return message === 'SESSION_EXPIRED' ? new SessionExpiredError() : new Error(message);
}

export async function fetchUserProfile(): Promise<UserProfile> {
  try {
    return await api.oauthFetchUser();
  } catch (err) {
    throw toSessionError(err);
  }
}

export async function fetchSubscriptions(): Promise<SubscriptionInfo[]> {
  try {
    return await api.oauthFetchSubscriptions();
  } catch (err) {
    throw toSessionError(err);
  }
}

/** Best-effort server-side revoke, then always clears local tokens. */
export async function logout(): Promise<void> {
  await api.oauthLogout();
}
