//! Tauri shell entry point. Wires the IPC command surface, generates the
//! TypeScript bindings (in debug builds), injects the live HTTP registry
//! fetcher, and resolves the app-data + home directories into shared state.

mod commands;
mod http_fetcher;
mod state;

use http_fetcher::HttpFetcher;
use state::AppState;
use tauri::Manager;

/// Curated-registry manifest URL.
///
/// PLACEHOLDER: the canonical location of the registry manifest is an open
/// design question (see the design spec §10 / DECISIONS). Until it is fixed,
/// an unreachable/placeholder URL simply means `get_registry` serves the
/// on-disk cache or the bundled snapshot — the shop stays usable offline.
const REGISTRY_URL: &str =
    "https://raw.githubusercontent.com/agentskills/registry/main/registry.json";

pub fn run() {
    // tauri-specta builder: single source of truth for the command set and the
    // generated TS bindings.
    let builder = tauri_specta::Builder::<tauri::Wry>::new().commands(tauri_specta::collect_commands![
        commands::get_registry,
        commands::list_skills,
        commands::check_conformance,
        commands::install_local_skill,
        commands::set_active_target,
        commands::get_active_target,
        commands::get_usage,
    ]);

    // Regenerate the frontend bindings on every debug build so TS can never
    // drift from the Rust commands.
    #[cfg(debug_assertions)]
    builder
        .export(
            // `total: u64` (usage counts) maps to a TS `number`: Tauri IPC
            // serializes via serde_json, which emits u64 as a JSON number, so
            // `number` matches the wire format. specta's default (Fail) aborts
            // on any bigint type.
            specta_typescript::Typescript::default()
                .bigint(specta_typescript::BigIntExportBehavior::Number),
            "../src/api/bindings.ts",
        )
        .expect("failed to export TypeScript bindings");

    tauri::Builder::default()
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            builder.mount_events(app);

            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir).ok();
            let home_dir = app.path().home_dir()?;

            let fetcher = Box::new(HttpFetcher::new(REGISTRY_URL));
            app.manage(AppState::new(fetcher, app_data_dir, home_dir));
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running skill-cellar");
}
