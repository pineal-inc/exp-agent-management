mod client;
mod config;
pub mod file_generator;
mod models;
pub mod realtime;
pub mod sync;

pub use client::SupabaseClient;
pub use config::{detect_app_mode, CrewConfig, ProjectConfig, SupabaseConfig, TeamConfig};
pub use file_generator::FileGenerator;
pub use models::*;
pub use realtime::{
    ConflictStrategy, RealtimeChange, RealtimeEventType, RealtimeMessage, RealtimeSubscription,
    create_heartbeat_message, create_join_message, realtime_ws_url, resolve_conflict,
};
pub use sync::SyncService;
