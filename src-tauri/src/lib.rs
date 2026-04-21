use serde::Serialize;
use std::process::Command;
use std::thread;
use tauri::Manager;


#[derive(Serialize)]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub start: String,
    pub end: String,
    pub is_all_day: bool,
    pub location: Option<String>,
    pub join_url: Option<String>,
}

#[tauri::command]
async fn get_calendar_events(
    app: tauri::AppHandle,
    offset_days: Option<i32>,
    calendar_names: Option<String>,
) -> Result<Vec<CalendarEvent>, String> {
    // Locate the bundled EventKit helper; fall back to AppleScript if absent.
    let helper_path = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| d.join("resources").join("calendar_helper"))
        .filter(|p| p.exists());

    let offset = offset_days.unwrap_or(0);
    let names = calendar_names.unwrap_or_default();

    if let Some(path) = helper_path {
        tauri::async_runtime::spawn_blocking(move || {
            let output = Command::new(&path)
                .arg(offset.to_string())
                .arg(&names)
                .output()
                .map_err(|e| format!("Failed to run calendar helper: {}", e))?;

            if !output.status.success() {
                let stderr = String::from_utf8_lossy(&output.stderr);
                return Err(format!("Calendar helper error: {}", stderr));
            }

            parse_calendar_output(&String::from_utf8_lossy(&output.stdout))
        })
        .await
        .map_err(|e| e.to_string())?
    } else {
        // AppleScript fallback (activates Calendar.app, but always available)
        tauri::async_runtime::spawn_blocking(move || {
            run_calendar_applescript(offset, &names)
        })
        .await
        .map_err(|e| e.to_string())?
    }
}

fn parse_calendar_output(stdout: &str) -> Result<Vec<CalendarEvent>, String> {
    let events = stdout
        .lines()
        .filter(|line| !line.trim().is_empty())
        .filter_map(|line| {
            let parts: Vec<&str> = line.splitn(6, "|||").collect();
            if parts.len() < 6 {
                return None;
            }
            let uid = parts[0].trim().to_string();
            let title = parts[1].trim().to_string();
            let start = parts[2].trim().to_string();
            let end = parts[3].trim().to_string();
            let is_all_day = parts[4].trim() == "true";
            let location = {
                let l = parts[5].trim().to_string();
                if l.is_empty() { None } else { Some(l) }
            };
            let join_url = extract_meeting_url(location.as_deref(), "");
            Some(CalendarEvent { id: uid, title, start, end, is_all_day, location, join_url })
        })
        .collect();
    Ok(events)
}

fn run_calendar_applescript(offset: i32, calendar_names: &str) -> Result<Vec<CalendarEvent>, String> {
    let allowed: Vec<String> = calendar_names
        .split(',')
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .collect();
    let allowed_list_as = if allowed.is_empty() {
        "{}".to_string()
    } else {
        let quoted: Vec<String> = allowed
            .iter()
            .map(|n| format!("\"{}\"", n.replace('"', "\\\"")))
            .collect();
        format!("{{{}}}", quoted.join(", "))
    };

    let script = format!(r#"
    set output to ""
    set allowedNames to {allowed_list}
    tell application "Calendar"
        set today to current date
        set offsetSeconds to {offset} * 86400
        set startOfDay to (today - (time of today)) + offsetSeconds
        set endOfDay to startOfDay + (24 * 60 * 60)
        repeat with cal in calendars
            try
                set calName to name of cal
                if (count of allowedNames) > 0 and allowedNames does not contain calName then
                else
                    with timeout of 60 seconds
                        set evts to every event of cal whose start date >= startOfDay and start date < endOfDay
                        set evtIdx to 0
                        repeat with e in evts
                            set evtIdx to evtIdx + 1
                            try
                                set t to summary of e
                                set s to start date of e as string
                                set en to end date of e as string
                                set allDay to "false"
                                try
                                    if allday event of e then set allDay to "true"
                                end try
                                set loc to ""
                                try
                                    with timeout of 5 seconds
                                        set loc to location of e
                                        if loc is missing value then set loc to ""
                                    end timeout
                                end try
                                set syntheticId to calName & "-" & evtIdx & "-" & s
                                set output to output & syntheticId & "|||" & t & "|||" & s & "|||" & en & "|||" & allDay & "|||" & loc & linefeed
                            end try
                        end repeat
                    end timeout
                end if
            end try
        end repeat
    end tell
    return output
    "#,
        allowed_list = allowed_list_as,
        offset = offset
    );

    let output = Command::new("osascript")
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| format!("Failed to execute AppleScript: {}", e))?;

    if !output.status.success() {
        return Err(format!("AppleScript error: {}", String::from_utf8_lossy(&output.stderr)));
    }

    parse_calendar_output(&String::from_utf8_lossy(&output.stdout))
}

/// Returns a list of "calendarName|||type" strings for all calendars visible
/// to Apple Calendar — no date filtering, no event fetching.  Used to
/// diagnose whether the Calendar bridge is working at all.
#[tauri::command]
async fn get_calendar_names() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let script = r#"
            set output to {}
            tell application "Calendar"
                repeat with cal in calendars
                    try
                        with timeout of 10 seconds
                            set calName to name of cal
                            set calType to "unknown"
                            try
                                set calType to type of cal as string
                            end try
                            set end of output to (calName & "|||" & calType)
                        end timeout
                    end try
                end repeat
            end tell
            set result to ""
            repeat with item in output
                set result to result & item & linefeed
            end repeat
            return result
        "#;

        let out = Command::new("osascript")
            .arg("-e")
            .arg(script)
            .output()
            .map_err(|e| format!("osascript failed: {}", e))?;

        if !out.status.success() {
            return Err(format!("AppleScript error: {}", String::from_utf8_lossy(&out.stderr)));
        }

        let stdout = String::from_utf8_lossy(&out.stdout);
        let names: Vec<String> = stdout
            .lines()
            .filter(|l| !l.trim().is_empty())
            .map(|l| l.trim().to_string())
            .collect();
        Ok(names)
    })
    .await
    .map_err(|e| e.to_string())?
}

fn extract_meeting_url(location: Option<&str>, description: &str) -> Option<String> {
    let patterns = ["https://teams.microsoft.com", "https://zoom.us", "https://meet.google.com", "https://webex.com"];
    let combined = format!("{} {}", location.unwrap_or(""), description);
    for token in combined.split_whitespace() {
        let token = token.trim_matches(|c: char| !c.is_alphanumeric() && c != ':' && c != '/' && c != '.' && c != '?' && c != '=' && c != '&' && c != '-' && c != '_' && c != '%');
        for pat in &patterns {
            if token.starts_with(pat) {
                return Some(token.to_string());
            }
        }
    }
    None
}

/// Opens a URL in the default system browser using macOS `open`.
/// Used as a reliable fallback when the shell plugin's open() is unavailable.
#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    Command::new("open")
        .arg(&url)
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Failed to open URL: {}", e))
}

/// Starts a one-shot local HTTP server on an OS-assigned port.
/// Returns the port immediately; the server runs in a background thread.
/// When a browser redirects to http://localhost:{port}/callback?code=..., the
/// thread emits an "oauth-callback" event with { code } or an
/// "oauth-callback-error" event with { error }.
#[tauri::command]
fn start_oauth_server(app: tauri::AppHandle) -> Result<u16, String> {
    use std::io::{BufRead, BufReader, Write};
    use std::net::TcpListener;
    use tauri::Emitter;

    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("Failed to bind OAuth server: {}", e))?;

    let port = listener
        .local_addr()
        .map_err(|e| format!("Failed to get port: {}", e))?
        .port();

    thread::spawn(move || {
        let html = "<!DOCTYPE html><html><body style='font-family:system-ui,sans-serif;\
display:flex;align-items:center;justify-content:center;height:100vh;margin:0;\
background:#0f172a;color:#e2e8f0'><div style='text-align:center'>\
<div style='font-size:3rem;margin-bottom:1rem'>&#10003;</div>\
<h2 style='margin:0 0 0.5rem'>Authorization complete</h2>\
<p style='margin:0;color:#94a3b8'>You can close this tab and return to the app.</p>\
</div></body></html>";

        match listener.accept() {
            Ok((mut stream, _)) => {
                let mut reader = BufReader::new(&stream);
                let mut request_line = String::new();
                let _ = reader.read_line(&mut request_line);

                let response = format!(
                    "HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\n\
Content-Length: {}\r\nConnection: close\r\n\r\n{}",
                    html.len(),
                    html
                );
                let _ = stream.write_all(response.as_bytes());

                // Parse ?code= from "GET /callback?code=XXX HTTP/1.1"
                let path = request_line.split_whitespace().nth(1).unwrap_or("");
                let query = path.split('?').nth(1).unwrap_or("");

                let mut code = String::new();
                let mut error = String::new();

                for pair in query.split('&') {
                    let mut kv = pair.splitn(2, '=');
                    match kv.next() {
                        Some("code") => {
                            code = kv.next().map(percent_decode).unwrap_or_default();
                        }
                        Some("error") | Some("error_description") if error.is_empty() => {
                            error = kv.next().map(percent_decode).unwrap_or_default();
                        }
                        _ => {}
                    }
                }

                if !code.is_empty() {
                    let _ = app.emit("oauth-callback", serde_json::json!({ "code": code }));
                } else {
                    let msg = if !error.is_empty() {
                        error
                    } else {
                        "No authorization code in callback".to_string()
                    };
                    let _ =
                        app.emit("oauth-callback-error", serde_json::json!({ "error": msg }));
                }
            }
            Err(e) => {
                let _ = app.emit(
                    "oauth-callback-error",
                    serde_json::json!({ "error": e.to_string() }),
                );
            }
        }
    });

    Ok(port)
}

#[tauri::command]
fn save_config_to_disk(app: tauri::AppHandle, config: serde_json::Value) -> Result<(), String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let path = dir.join("app_config.json");
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    std::fs::write(&path, json).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn load_config_from_disk(app: tauri::AppHandle) -> Result<Option<serde_json::Value>, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let path = dir.join("app_config.json");
    if !path.exists() {
        return Ok(None);
    }
    let json = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let value = serde_json::from_str(&json).map_err(|e| e.to_string())?;
    Ok(Some(value))
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut result = String::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hi = (bytes[i + 1] as char).to_digit(16);
            let lo = (bytes[i + 2] as char).to_digit(16);
            if let (Some(hi), Some(lo)) = (hi, lo) {
                result.push((hi * 16 + lo) as u8 as char);
                i += 3;
                continue;
            }
        } else if bytes[i] == b'+' {
            result.push(' ');
            i += 1;
            continue;
        }
        result.push(bytes[i] as char);
        i += 1;
    }
    result
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .invoke_handler(tauri::generate_handler![get_calendar_events, get_calendar_names, start_oauth_server, open_url, save_config_to_disk, load_config_from_disk])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
