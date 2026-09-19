use keyring::Entry;
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

// Service name doubles as the app identifier so entries don't collide with
// other apps' credentials in the OS-native store (Windows Credential Manager /
// macOS Keychain).
const SERVICE: &str = "lk.novalink.zerotrace.desktop";
const API_BASE: &str = "https://dash.novalink.lk";
// The backend pairs client_id with platform: netch-macos + macos is accepted, but netch-windows +
// macos is rejected with a 400 at the Authorize step. Every non-macOS build keeps the windows pair.
const CLIENT_ID: &str = if cfg!(target_os = "macos") { "netch-macos" } else { "netch-windows" };
const REDIRECT_URI: &str = "netchvpn://auth/callback";
const DEVICE_NAME: &str = "ZeroTrace Desktop";
// Shown on the dashboard's authorize prompt and device list.
const PLATFORM: &str = if cfg!(target_os = "macos") { "macos" } else { "windows" };
// Sentinel error string the frontend matches on to distinguish "please sign in
// again" from a transient network/server error.
const SESSION_EXPIRED: &str = "SESSION_EXPIRED";

// All backend calls happen here in Rust rather than via the webview's fetch():
// dash.novalink.lk sends no Access-Control-Allow-Origin header, so a browser-side
// fetch() is blocked by CORS before it ever reaches the response. Rust's HTTP
// client isn't a browser and isn't subject to CORS at all.

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent(concat!("ZeroTrace-Desktop/", env!("CARGO_PKG_VERSION")))
        .build()
        .unwrap_or_default()
}

// reqwest's own .json() error is just "error decoding response body", which hides whether the
// server sent HTML (WAF/rate-limit page), an unexpected JSON shape, or nothing at all.
async fn parse_json<T: serde::de::DeserializeOwned>(res: reqwest::Response) -> Result<T, String> {
    let status = res.status();
    let body = res.text().await.map_err(|e| e.to_string())?;
    serde_json::from_str(&body).map_err(|e| {
        let snippet: String = body.chars().take(200).collect();
        format!("HTTP {status}: {e} | body: {snippet}")
    })
}

fn entry(username: &str) -> Result<Entry, String> {
    Entry::new(SERVICE, username).map_err(|e| e.to_string())
}

fn read(username: &str) -> Result<Option<String>, String> {
    match entry(username)?.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn delete(username: &str) -> Result<(), String> {
    match entry(username)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// Both tokens live in ONE keychain item and are read at most once per launch. An ad-hoc-signed
// build has a different code identity every rebuild, so macOS re-prompts on every keychain read
// until the user picks "Always Allow" — reading once keeps that to a single prompt.
#[derive(Serialize, Deserialize, Clone)]
struct Session {
    access: String,
    refresh: String,
    // Profile picture from the token-exchange response. Default keeps sessions saved before this
    // field existed readable.
    #[serde(default)]
    avatar: String,
}

const SESSION_ITEM: &str = "session";

// Outer None = keychain not read yet this run; Some(None) = read, no session.
static SESSION: Mutex<Option<Option<Session>>> = Mutex::new(None);

fn load_session() -> Result<Option<Session>, String> {
    let mut cache = SESSION.lock();
    if let Some(cached) = cache.as_ref() {
        return Ok(cached.clone());
    }
    let loaded = read(SESSION_ITEM)?.and_then(|json| serde_json::from_str::<Session>(&json).ok());
    *cache = Some(loaded.clone());
    Ok(loaded)
}

fn save_session(access: &str, refresh: &str, avatar: &str) -> Result<(), String> {
    let session = Session { access: access.to_string(), refresh: refresh.to_string(), avatar: avatar.to_string() };
    let json = serde_json::to_string(&session).map_err(|e| e.to_string())?;
    entry(SESSION_ITEM)?.set_password(&json).map_err(|e| e.to_string())?;
    *SESSION.lock() = Some(Some(session));
    Ok(())
}

fn clear_session() -> Result<(), String> {
    *SESSION.lock() = Some(None);
    delete(SESSION_ITEM)?;
    // Separate per-token items written by earlier builds.
    let _ = delete("access_token");
    let _ = delete("refresh_token");
    Ok(())
}

// A success response looks like {success: true, access_token, refresh_token, ...}. An error
// response is standard OAuth2 shape instead: {error, error_description} with no `success` key
// at all — presence of access_token/refresh_token is what we actually branch on below, so
// `success` isn't needed.
#[derive(Deserialize)]
struct TokenResponse {
    access_token: Option<String>,
    refresh_token: Option<String>,
    message: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
    // Only the authorization_code exchange includes this.
    user: Option<serde_json::Value>,
}

impl TokenResponse {
    fn error_text(&self) -> String {
        self.error_description.clone()
            .or_else(|| self.message.clone())
            .or_else(|| self.error.clone())
            .unwrap_or_else(|| "Sign-in failed".to_string())
    }
}

async fn refresh_session(client: &reqwest::Client) -> Result<String, String> {
    let current = load_session()?.ok_or_else(|| SESSION_EXPIRED.to_string())?;
    let refresh = current.refresh;
    let res = client
        .post(format!("{API_BASE}/api/v1/auth/token"))
        .json(&serde_json::json!({ "grant_type": "refresh_token", "refresh_token": refresh }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let data: TokenResponse = parse_json(res).await?;

    let (Some(access), Some(new_refresh)) = (&data.access_token, &data.refresh_token) else {
        let _ = clear_session();
        return Err(SESSION_EXPIRED.to_string());
    };
    save_session(access, new_refresh, &current.avatar)?;
    Ok(access.clone())
}

/// Authenticated request with one refresh-and-retry on 401.
async fn authorized_request(
    client: &reqwest::Client,
    method: reqwest::Method,
    path: &str,
) -> Result<reqwest::Response, String> {
    let access = load_session()?.ok_or_else(|| SESSION_EXPIRED.to_string())?.access;
    let url = format!("{API_BASE}{path}");

    let res = client
        .request(method.clone(), &url)
        .bearer_auth(&access)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if res.status() == reqwest::StatusCode::UNAUTHORIZED {
        let new_access = refresh_session(client).await?;
        return client
            .request(method, &url)
            .bearer_auth(&new_access)
            .send()
            .await
            .map_err(|e| e.to_string());
    }
    Ok(res)
}

#[tauri::command]
pub async fn oauth_has_session() -> Result<bool, String> {
    Ok(load_session()?.is_some())
}

#[tauri::command]
pub fn oauth_authorize_url(code_challenge: String, state: String) -> String {
    let params = [
        ("client_id", CLIENT_ID),
        ("redirect_uri", REDIRECT_URI),
        ("code_challenge", &code_challenge),
        ("code_challenge_method", "S256"),
        ("state", &state),
        ("device_name", DEVICE_NAME),
        ("platform", PLATFORM),
    ];
    let query = url::form_urlencoded::Serializer::new(String::new())
        .extend_pairs(params)
        .finish();
    format!("{API_BASE}/auth/app/authorize?{query}")
}

#[tauri::command]
pub async fn oauth_exchange_code(code: String, verifier: String) -> Result<(), String> {
    let client = http_client();
    let res = client
        .post(format!("{API_BASE}/api/v1/auth/token"))
        .json(&serde_json::json!({
            "grant_type": "authorization_code",
            "code": code,
            "code_verifier": verifier,
            "redirect_uri": REDIRECT_URI,
            "device_name": DEVICE_NAME,
            "platform": PLATFORM,
        }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let data: TokenResponse = parse_json(res).await?;

    let (Some(access), Some(refresh)) = (&data.access_token, &data.refresh_token) else {
        return Err(data.error_text());
    };
    let avatar = data.user.as_ref().map(avatar_from).unwrap_or_default();
    save_session(access, refresh, &avatar)
}

// The backend sends explicit `null` for fields that don't apply (e.g. expiry.date on a plan
// that never expires, limit_gb on an unlimited plan). serde treats null as a type error for
// plain String/f64/bool, so every optional-in-practice field goes through this: null or missing
// becomes the type's default ("" / 0 / false), which is what the frontend already renders.
fn nullable<'de, D, T>(d: D) -> Result<T, D::Error>
where
    D: serde::Deserializer<'de>,
    T: Deserialize<'de> + Default,
{
    Ok(Option::<T>::deserialize(d)?.unwrap_or_default())
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserProfileDto {
    pub id: i64,
    #[serde(default, deserialize_with = "nullable")]
    pub name: String,
    #[serde(default, deserialize_with = "nullable")]
    pub email: String,
    #[serde(default, deserialize_with = "nullable")]
    pub balance: f64,
    // Filled by avatar_from() below, never read straight from the response.
    #[serde(skip_deserializing)]
    pub avatar_url: String,
}

#[derive(Deserialize)]
struct UserResponse {
    data: Option<serde_json::Value>,
}

// The guide doesn't document a profile-picture field, so accept the common names. Relative
// paths are resolved against the dashboard. Empty string = none (frontend shows an initial).
fn avatar_from(user: &serde_json::Value) -> String {
    const KEYS: [&str; 8] =
        ["avatar_url", "avatar", "picture", "profile_picture", "profile_image", "image", "photo", "photo_url"];
    KEYS.iter()
        .find_map(|k| user.get(k).and_then(|v| v.as_str()).filter(|s| !s.is_empty()))
        .map(|s| if s.starts_with('/') { format!("{API_BASE}{s}") } else { s.to_string() })
        .unwrap_or_default()
}

#[tauri::command]
pub async fn oauth_fetch_user() -> Result<UserProfileDto, String> {
    let client = http_client();
    let res = authorized_request(&client, reqwest::Method::GET, "/api/v1/user").await?;
    let data: UserResponse = parse_json(res).await?;
    let user = data.data.ok_or_else(|| "Failed to load profile".to_string())?;
    let mut profile: UserProfileDto = serde_json::from_value(user.clone()).map_err(|e| e.to_string())?;
    profile.avatar_url = avatar_from(&user);
    if profile.avatar_url.is_empty() {
        // /api/v1/user may not repeat the picture; use the one from sign-in.
        profile.avatar_url = load_session()?.map(|s| s.avatar).unwrap_or_default();
    }
    Ok(profile)
}

// Field names below serialize as camelCase for the frontend (via rename_all) while also
// accepting the backend's snake_case JSON on the way in (via each multi-word field's `alias`).

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionExpiryDto {
    #[serde(default, deserialize_with = "nullable")]
    pub date: String,
    #[serde(default, deserialize_with = "nullable", alias = "days_remaining")]
    pub days_remaining: i64,
    #[serde(default, deserialize_with = "nullable", alias = "is_expired")]
    pub is_expired: bool,
    #[serde(default, deserialize_with = "nullable", alias = "never_expires")]
    pub never_expires: bool,
}

#[derive(Serialize, Deserialize, Clone, Default)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionUsageDto {
    #[serde(default, deserialize_with = "nullable", alias = "download_gb")]
    pub download_gb: f64,
    #[serde(default, deserialize_with = "nullable", alias = "upload_gb")]
    pub upload_gb: f64,
    #[serde(default, deserialize_with = "nullable", alias = "total_gb")]
    pub total_gb: f64,
    #[serde(default, deserialize_with = "nullable", alias = "limit_gb")]
    pub limit_gb: f64,
    #[serde(default, deserialize_with = "nullable", alias = "used_percentage")]
    pub used_percentage: f64,
}

#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionDto {
    pub id: i64,
    #[serde(default, deserialize_with = "nullable")]
    pub status: String,
    #[serde(default, deserialize_with = "nullable", alias = "plan_name")]
    pub plan_name: String,
    #[serde(default, deserialize_with = "nullable", alias = "package_name")]
    pub package_name: String,
    #[serde(default, deserialize_with = "nullable", alias = "server_location")]
    pub server_location: String,
    #[serde(default, deserialize_with = "nullable", alias = "config_url")]
    pub config_url: String,
    #[serde(default, deserialize_with = "nullable")]
    pub expiry: SubscriptionExpiryDto,
    #[serde(default, deserialize_with = "nullable")]
    pub usage: SubscriptionUsageDto,
}

#[derive(Deserialize)]
struct SubscriptionsResponse {
    data: Option<Vec<SubscriptionDto>>,
}

#[tauri::command]
pub async fn oauth_fetch_subscriptions() -> Result<Vec<SubscriptionDto>, String> {
    let client = http_client();
    let res = authorized_request(&client, reqwest::Method::GET, "/api/v1/subscriptions").await?;
    let data: SubscriptionsResponse = parse_json(res).await?;
    // A missing `data` key means an error body, not "no subscriptions" — the frontend prunes
    // synced configs against this list, so an empty result must only ever mean genuinely empty.
    data.data.ok_or_else(|| "Failed to load subscriptions".to_string())
}

#[tauri::command]
pub async fn oauth_logout() -> Result<(), String> {
    let client = http_client();
    if let Ok(Some(session)) = load_session() {
        let _ = client
            .post(format!("{API_BASE}/api/v1/auth/revoke"))
            .bearer_auth(session.access)
            .send()
            .await;
    }
    clear_session()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn authorize_url_sends_a_matching_client_id_and_platform() {
        let expected = if cfg!(target_os = "macos") { "macos" } else { "windows" };
        let url = oauth_authorize_url("challenge".into(), "state".into());
        assert!(url.contains(&format!("platform={expected}")), "{url}");
        assert!(url.contains(&format!("client_id=netch-{expected}")), "{url}");
    }

    #[test]
    fn token_exchange_user_avatar_is_extracted() {
        let body = r#"{"access_token":"a","refresh_token":"r","user":{"id":1,"name":"N",
            "picture":"https://lh3.googleusercontent.com/x=s96","avatar_url":"https://lh3.googleusercontent.com/x=s96",
            "balance_cents":0,"balance":0.0}}"#;
        let parsed: TokenResponse = serde_json::from_str(body).unwrap();
        assert_eq!(avatar_from(parsed.user.as_ref().unwrap()), "https://lh3.googleusercontent.com/x=s96");
        // Only `picture` present, relative path, and nothing at all.
        let only_picture = serde_json::json!({ "picture": "https://p/x.png" });
        assert_eq!(avatar_from(&only_picture), "https://p/x.png");
        let relative = serde_json::json!({ "avatar_url": "/static/a.png" });
        assert_eq!(avatar_from(&relative), format!("{API_BASE}/static/a.png"));
        assert_eq!(avatar_from(&serde_json::json!({ "avatar_url": null })), "");
    }

    #[test]
    fn subscriptions_tolerate_null_fields() {
        let body = r#"{"count":1,"data":[{"id":7,"status":"active","plan_name":null,
            "package_name":"Pkg","server_location":null,"config_url":"vless://x@h:443",
            "expiry":{"date":null,"days_remaining":null,"is_expired":false,"never_expires":true},
            "usage":{"download_gb":1.5,"upload_gb":null,"total_gb":1.5,"limit_gb":null,"used_percentage":null}}]}"#;
        let parsed: SubscriptionsResponse = serde_json::from_str(body).unwrap();
        let sub = &parsed.data.unwrap()[0];
        assert_eq!(sub.plan_name, "");
        assert_eq!(sub.expiry.date, "");
        assert!(sub.expiry.never_expires);
        assert_eq!(sub.usage.limit_gb, 0.0);
        assert_eq!(serde_json::to_value(sub).unwrap()["packageName"], "Pkg");
    }
}
