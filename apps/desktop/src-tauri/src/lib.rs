// Bloodawn
//
// Copyright (c) 2025 Age-Of-Ages
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use std::path::PathBuf;
use tauri::{path::BaseDirectory, AppHandle, Emitter, Manager, Window};
use tauri_plugin_dialog::{DialogExt, FilePath};
use tauri_plugin_shell::{process::CommandChild, process::CommandEvent, ShellExt};

const TEST_RUN_EVENT: &str = "devtools://test-run";

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
enum LogLevel {
    Info,
    Warn,
    Error,
}

#[derive(Debug, Clone, Copy, Serialize)]
#[serde(rename_all = "lowercase")]
enum LogSource {
    Stdout,
    Stderr,
}

#[derive(Debug, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
enum TestRunPayload {
    Started,
    Log {
        level: LogLevel,
        message: String,
        source: LogSource,
    },
    Terminated {
        code: Option<i32>,
    },
    Error {
        message: String,
    },
}

#[derive(Debug, Deserialize, Default)]
pub struct FileFilter {
    pub name: Option<String>,
    pub extensions: Vec<String>,
}

#[derive(Debug, Deserialize, Default)]
#[serde(default)]
pub struct FilePickRequest {
    pub multiple: bool,
    pub directory: bool,
    pub filters: Vec<FileFilter>,
}

fn normalize_extensions(source: &[String]) -> Vec<String> {
    source
        .iter()
        .map(|ext| ext.trim_start_matches('.').to_ascii_lowercase())
        .filter(|ext| !ext.is_empty())
        .collect()
}

fn paths_to_strings(paths: Vec<FilePath>) -> Result<Vec<String>, String> {
    paths
        .into_iter()
        .map(|path| {
            path.simplified()
                .into_path()
                .map_err(|err| err.to_string())
                .map(|pb| pb.to_string_lossy().into_owned())
        })
        .collect()
}

fn sanitize_line(bytes: Vec<u8>) -> Option<String> {
    let text = String::from_utf8(bytes).ok()?;
    let cleaned = text.trim_end_matches(['\r', '\n']);
    if cleaned.is_empty() {
        None
    } else {
        Some(cleaned.to_string())
    }
}

fn classify_level(source: LogSource, message: &str) -> LogLevel {
    if matches!(source, LogSource::Stderr) {
        return LogLevel::Error;
    }

    let upper = message.to_ascii_uppercase();
    if upper.contains("FAIL") || upper.contains("ERROR") {
        LogLevel::Error
    } else if upper.contains("WARN") {
        LogLevel::Warn
    } else {
        LogLevel::Info
    }
}

#[derive(Default)]
struct TestRunnerState {
    child: Arc<Mutex<Option<CommandChild>>>,
}

fn locate_workspace_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(current) = std::env::current_dir() {
        candidates.push(current);
    }

    if let Ok(resource_parent) = app.path().resolve("..", BaseDirectory::Resource) {
        candidates.push(resource_parent);
    }

    let mut visited: HashSet<PathBuf> = HashSet::new();

    for mut candidate in candidates {
        loop {
            if !visited.insert(candidate.clone()) {
                match candidate.parent() {
                    Some(parent) => {
                        candidate = parent.to_path_buf();
                        continue;
                    }
                    None => break,
                }
            }

            let package = candidate.join("package.json");
            if package.is_file() {
                return Ok(candidate);
            }

            match candidate.parent() {
                Some(parent) => candidate = parent.to_path_buf(),
                None => break,
            }
        }
    }

    Err("Unable to locate workspace directory for npm".into())
}

#[tauri::command]
async fn db_query(
    _app: AppHandle,
    _query: String,
    _values: Option<Vec<Value>>,
) -> Result<Value, String> {
    Err("dbQuery is not implemented yet".into())
}

#[tauri::command]
async fn file_pick(
    app: AppHandle,
    payload: Option<FilePickRequest>,
) -> Result<Option<Vec<String>>, String> {
    let request = payload.unwrap_or_default();
    let mut dialog = app.dialog().file();

    for filter in &request.filters {
        let cleaned = normalize_extensions(&filter.extensions);
        if cleaned.is_empty() {
            continue;
        }
        let refs: Vec<&str> = cleaned.iter().map(|ext| ext.as_str()).collect();
        dialog = dialog.add_filter(filter.name.clone().unwrap_or_default(), refs.as_slice());
    }

    let selection = if request.directory {
        if request.multiple {
            dialog.blocking_pick_folders()
        } else {
            dialog.blocking_pick_folder().map(|single| vec![single])
        }
    } else if request.multiple {
        dialog.blocking_pick_files()
    } else {
        dialog.blocking_pick_file().map(|single| vec![single])
    };

    match selection {
        Some(paths) => paths_to_strings(paths).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
async fn index_pdf(
    _app: AppHandle,
    _file_id: String,
    _absolute_path: String,
) -> Result<(), String> {
    // The heavy lifting happens when the PDF worker pipeline lands in step 3.
    Ok(())
}

#[tauri::command]
async fn run_full_test_suite(
    window: Window,
    state: State<'_, TestRunnerState>,
) -> Result<(), String> {
    let app = window.app_handle();
    let workspace_dir = locate_workspace_dir(&app)?;

    let command = app
        .shell()
        .command("npm")
        .args(["run", "test:full"])
        .current_dir(&workspace_dir)
        .env("FORCE_COLOR", "0")
        .env("npm_config_color", "false");

    let mut guard = state
        .child
        .lock()
        .map_err(|_| "Unable to access test runner state".to_string())?;
    if guard.is_some() {
        return Err("Test suite is already running".into());
    }

    let (mut rx, child) = command.spawn().map_err(|err| err.to_string())?;
    *guard = Some(child);
    drop(guard);

    let _ = window.emit(TEST_RUN_EVENT, &TestRunPayload::Started);

    let event_window = window.clone();
    let runner_state = Arc::clone(&state.child);
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    if let Some(message) = sanitize_line(line) {
                        let level = classify_level(LogSource::Stdout, &message);
                        let payload = TestRunPayload::Log {
                            level,
                            message,
                            source: LogSource::Stdout,
                        };
                        let _ = event_window.emit(TEST_RUN_EVENT, &payload);
                    }
                }
                CommandEvent::Stderr(line) => {
                    if let Some(message) = sanitize_line(line) {
                        let level = classify_level(LogSource::Stderr, &message);
                        let payload = TestRunPayload::Log {
                            level,
                            message,
                            source: LogSource::Stderr,
                        };
                        let _ = event_window.emit(TEST_RUN_EVENT, &payload);
                    }
                }
                CommandEvent::Terminated(details) => {
                    if let Ok(mut guard) = runner_state.lock() {
                        let _ = guard.take();
                    }
                    let payload = TestRunPayload::Terminated { code: details.code };
                    let _ = event_window.emit(TEST_RUN_EVENT, &payload);
                }
                CommandEvent::Error(error) => {
                    if let Ok(mut guard) = runner_state.lock() {
                        let _ = guard.take();
                    }
                    let payload = TestRunPayload::Error { message: error };
                    let _ = event_window.emit(TEST_RUN_EVENT, &payload);
                }
                _ => {}
            }
        }
    });

    Ok(())
}

#[tauri::command]
async fn cancel_full_test_suite(state: State<'_, TestRunnerState>) -> Result<(), String> {
    let child = {
        let mut guard = state
            .child
            .lock()
            .map_err(|_| "Unable to access test runner state".to_string())?;
        guard.take()
    };

    if let Some(mut child) = child {
        child.kill().map_err(|err| err.to_string())?
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_shell::init())
        .manage(TestRunnerState::default())
        .invoke_handler(tauri::generate_handler![
            db_query,
            file_pick,
            index_pdf,
            run_full_test_suite,
            cancel_full_test_suite
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
