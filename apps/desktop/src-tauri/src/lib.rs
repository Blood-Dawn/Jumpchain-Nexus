// MIT License
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

use serde::Deserialize;
use serde_json::Value;
use tauri::AppHandle;
use tauri_plugin_dialog::{DialogExt, FilePath};

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

#[tauri::command]
pub async fn db_query(
    _app: AppHandle,
    _query: String,
    _values: Option<Vec<Value>>,
) -> Result<Value, String> {
    Err("dbQuery is not implemented yet".into())
}

#[tauri::command]
pub async fn file_pick(
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
            dialog
                .blocking_pick_folder()
                .map(|opt| opt.map(|single| vec![single]))
        }
    } else if request.multiple {
        dialog.blocking_pick_files()
    } else {
        dialog
            .blocking_pick_file()
            .map(|opt| opt.map(|single| vec![single]))
    };

    match selection {
        Some(paths) => paths_to_strings(paths).map(Some),
        None => Ok(None),
    }
}

#[tauri::command]
pub async fn index_pdf(
    _app: AppHandle,
    _file_id: String,
    _absolute_path: String,
) -> Result<(), String> {
    // The heavy lifting happens when the PDF worker pipeline lands in step 3.
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .invoke_handler(tauri::generate_handler![db_query, file_pick, index_pdf])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
