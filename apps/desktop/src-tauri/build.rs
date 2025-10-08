fn main() {
    println!("cargo:rustc-check-cfg=cfg(mobile)");

    if std::env::var("TAURI_SKIP_EXTERNAL_BIN_CHECK").is_ok() {
        return;
    }

    tauri_build::build()
}
