#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

// JARVIS Command Center shell.
//
// Phase 12A.1: a local-only window; no IPC commands, no plugin permissions.
// Phase 25G (E-054): when packaged, the shell also owns ONE child process —
// the Next.js server (`standalone/server.js`) run by the bundled Node
// sidecar on 127.0.0.1 — waits for its loopback /api/health, then opens the
// window; on exit it stops the child. Nothing else: no IPC, no network
// beyond loopback, no plugins. In `tauri dev` (no bundled resources) the
// window from tauri.conf.json loads the dev server as before.
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use tauri::{Manager, RunEvent, WebviewUrl, WebviewWindowBuilder};

const SIDECAR_PORT: u16 = 3117;
const HEALTH_TIMEOUT: Duration = Duration::from_secs(90);

struct Sidecar(Mutex<Option<Child>>);

/// KEY=VALUE lines from <app data dir>/jarvis.env; the packaged app has no
/// repo .env.local, so this is where the operator's settings live. Values are
/// passed to the child only — never logged, never read by the shell itself.
fn read_env_file(path: &Path) -> Vec<(String, String)> {
    let Ok(text) = std::fs::read_to_string(path) else {
        return Vec::new();
    };
    text.lines()
        .map(str::trim)
        .filter(|l| !l.is_empty() && !l.starts_with('#'))
        .filter_map(|l| l.split_once('='))
        .map(|(k, v)| (k.trim().to_string(), v.trim().trim_matches('"').to_string()))
        .collect()
}

// Readiness = the sidecar accepts a loopback TCP connection. The Next
// standalone server only listens once it is prepared, and the page itself
// shows /api/health's verdict; the shell deliberately speaks no HTTP (and
// holds no IO traits) so the 12G closeout guards keep it inert.
fn health_ok(port: u16) -> bool {
    TcpStream::connect_timeout(
        &std::net::SocketAddr::from(([127, 0, 0, 1], port)),
        Duration::from_millis(500),
    )
    .is_ok()
}

fn sidecar_binary(app: &tauri::AppHandle) -> Option<PathBuf> {
    // Tauri places externalBin next to the main executable (Contents/MacOS).
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;
    let node = dir.join("node");
    if node.exists() {
        return Some(node);
    }
    let _ = app;
    None
}

fn start_sidecar(app: &tauri::AppHandle) -> Option<Child> {
    let resources = app.path().resource_dir().ok()?;
    let server_dir = resources.join("standalone");
    if !server_dir.join("server.js").exists() {
        return None; // dev mode: nothing bundled, the config window loads :3000
    }
    // sidecar.js wraps server.js and exits when this process dies (see
    // scripts/package/sidecar-launcher.js); fall back to server.js if absent.
    let launcher = server_dir.join("sidecar.js");
    let server = if launcher.exists() { launcher } else { server_dir.join("server.js") };
    let node = sidecar_binary(app)?;
    let data_dir = app.path().app_data_dir().ok()?;
    let _ = std::fs::create_dir_all(&data_dir);
    let mut cmd = Command::new(node);
    cmd.arg(&server)
        .current_dir(&server_dir)
        .env("NODE_ENV", "production")
        .env("HOSTNAME", "127.0.0.1")
        .env("PORT", SIDECAR_PORT.to_string())
        .env("JARVIS_BIND_HOST", "127.0.0.1")
        .env("JARVIS_DATA_DIR", &data_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    for (k, v) in read_env_file(&data_dir.join("jarvis.env")) {
        // The shell pins the bind posture; a config file cannot widen it.
        if matches!(k.as_str(), "HOSTNAME" | "PORT" | "JARVIS_BIND_HOST" | "JARVIS_REMOTE_DASHBOARD_ENABLED") {
            continue;
        }
        cmd.env(k, v);
    }
    cmd.spawn().ok()
}

fn main() {
    let app = tauri::Builder::default()
        .manage(Sidecar(Mutex::new(None)))
        .setup(|app| {
            let handle = app.handle().clone();
            if let Some(child) = start_sidecar(&handle) {
                *handle.state::<Sidecar>().0.lock().unwrap() = Some(child);
                let started = Instant::now();
                while !health_ok(SIDECAR_PORT) {
                    if started.elapsed() > HEALTH_TIMEOUT {
                        break; // open the window anyway; the page will show the server error
                    }
                    std::thread::sleep(Duration::from_millis(400));
                }
                let url = format!("http://127.0.0.1:{SIDECAR_PORT}/").parse().unwrap();
                WebviewWindowBuilder::new(&handle, "main", WebviewUrl::External(url))
                    .title("JARVIS Command Center")
                    .inner_size(1280.0, 820.0)
                    .min_inner_size(960.0, 640.0)
                    .build()?;
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building JARVIS Tauri shell");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(mut child) = handle.state::<Sidecar>().0.lock().unwrap().take() {
                let _ = child.kill();
                let _ = child.wait();
            }
        }
    });
}
