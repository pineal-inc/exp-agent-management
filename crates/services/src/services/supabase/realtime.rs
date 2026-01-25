use serde::{Deserialize, Serialize};

/// Realtime event types
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "UPPERCASE")]
pub enum RealtimeEventType {
    Insert,
    Update,
    Delete,
}

/// A realtime change event from Supabase
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimeChange {
    pub table: String,
    pub event_type: RealtimeEventType,
    pub old_record: Option<serde_json::Value>,
    pub new_record: Option<serde_json::Value>,
}

/// Supabase realtime message format (for frontend to parse)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimeMessage {
    pub topic: String,
    pub event: String,
    pub payload: serde_json::Value,
    #[serde(rename = "ref")]
    pub msg_ref: Option<String>,
}

impl RealtimeMessage {
    /// Parse a change from the message payload
    pub fn parse_change(&self) -> Option<RealtimeChange> {
        if self.event == "postgres_changes" {
            serde_json::from_value(self.payload.clone()).ok()
        } else {
            None
        }
    }
}

/// Configuration for realtime subscriptions
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RealtimeSubscription {
    pub channel_name: String,
    pub table: String,
    pub filter: Option<String>,
    pub schema: String,
}

impl RealtimeSubscription {
    /// Create a subscription for a table
    pub fn new(table: &str, filter: Option<&str>) -> Self {
        Self {
            channel_name: format!("realtime:public:{}", table),
            table: table.to_string(),
            filter: filter.map(|s| s.to_string()),
            schema: "public".to_string(),
        }
    }

    /// Create a subscription for tasks in a project
    pub fn tasks(project_id: &str) -> Self {
        Self::new("tasks", Some(&format!("project_id=eq.{}", project_id)))
    }

    /// Create a subscription for stories in a project
    pub fn stories(project_id: &str) -> Self {
        Self::new("stories", Some(&format!("project_id=eq.{}", project_id)))
    }

    /// Create a subscription for team members
    pub fn team_members(team_id: &str) -> Self {
        Self::new("team_members", Some(&format!("team_id=eq.{}", team_id)))
    }
}

/// Conflict resolution strategy
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ConflictStrategy {
    /// Last writer wins based on updated_at timestamp
    LastWriterWins,
    /// Keep local changes
    KeepLocal,
    /// Accept remote changes
    AcceptRemote,
}

/// Resolve conflicts between local and remote records
pub fn resolve_conflict(
    local: &serde_json::Value,
    remote: &serde_json::Value,
    strategy: ConflictStrategy,
) -> serde_json::Value {
    match strategy {
        ConflictStrategy::LastWriterWins => {
            let local_updated = local
                .get("updated_at")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let remote_updated = remote
                .get("updated_at")
                .and_then(|v| v.as_str())
                .unwrap_or("");

            if remote_updated > local_updated {
                remote.clone()
            } else {
                local.clone()
            }
        }
        ConflictStrategy::KeepLocal => local.clone(),
        ConflictStrategy::AcceptRemote => remote.clone(),
    }
}

/// Generate Supabase realtime WebSocket URL
pub fn realtime_ws_url(supabase_url: &str, anon_key: &str) -> String {
    let ws_url = supabase_url
        .replace("https://", "wss://")
        .replace("http://", "ws://");
    format!("{}/realtime/v1/websocket?apikey={}&vsn=1.0.0", ws_url, anon_key)
}

/// Generate a join message for a realtime channel
pub fn create_join_message(subscription: &RealtimeSubscription, msg_ref: &str) -> RealtimeMessage {
    let config = serde_json::json!({
        "postgres_changes": [{
            "event": "*",
            "schema": subscription.schema,
            "table": subscription.table,
            "filter": subscription.filter.as_deref().unwrap_or("")
        }]
    });

    RealtimeMessage {
        topic: subscription.channel_name.clone(),
        event: "phx_join".to_string(),
        payload: config,
        msg_ref: Some(msg_ref.to_string()),
    }
}

/// Generate a heartbeat message
pub fn create_heartbeat_message(msg_ref: &str) -> RealtimeMessage {
    RealtimeMessage {
        topic: "phoenix".to_string(),
        event: "heartbeat".to_string(),
        payload: serde_json::json!({}),
        msg_ref: Some(msg_ref.to_string()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_conflict_resolution_last_writer_wins() {
        let local = serde_json::json!({
            "id": "1",
            "title": "Local Title",
            "updated_at": "2024-01-01T10:00:00Z"
        });

        let remote = serde_json::json!({
            "id": "1",
            "title": "Remote Title",
            "updated_at": "2024-01-01T11:00:00Z"
        });

        let result = resolve_conflict(&local, &remote, ConflictStrategy::LastWriterWins);
        assert_eq!(result["title"], "Remote Title");

        // Test with local being newer
        let local_newer = serde_json::json!({
            "id": "1",
            "title": "Local Title",
            "updated_at": "2024-01-01T12:00:00Z"
        });

        let result = resolve_conflict(&local_newer, &remote, ConflictStrategy::LastWriterWins);
        assert_eq!(result["title"], "Local Title");
    }

    #[test]
    fn test_conflict_resolution_keep_local() {
        let local = serde_json::json!({"title": "Local"});
        let remote = serde_json::json!({"title": "Remote"});

        let result = resolve_conflict(&local, &remote, ConflictStrategy::KeepLocal);
        assert_eq!(result["title"], "Local");
    }

    #[test]
    fn test_conflict_resolution_accept_remote() {
        let local = serde_json::json!({"title": "Local"});
        let remote = serde_json::json!({"title": "Remote"});

        let result = resolve_conflict(&local, &remote, ConflictStrategy::AcceptRemote);
        assert_eq!(result["title"], "Remote");
    }

    #[test]
    fn test_realtime_ws_url() {
        let url = realtime_ws_url("https://abc.supabase.co", "test-key");
        assert!(url.starts_with("wss://"));
        assert!(url.contains("apikey=test-key"));
    }

    #[test]
    fn test_subscription_creation() {
        let sub = RealtimeSubscription::tasks("123-456");
        assert_eq!(sub.table, "tasks");
        assert_eq!(sub.filter.as_deref(), Some("project_id=eq.123-456"));
    }

    #[test]
    fn test_join_message_creation() {
        let sub = RealtimeSubscription::tasks("test-project");
        let msg = create_join_message(&sub, "1");

        assert_eq!(msg.event, "phx_join");
        assert!(msg.payload.get("postgres_changes").is_some());
    }

    #[test]
    fn test_parse_change() {
        let msg = RealtimeMessage {
            topic: "realtime:public:tasks".to_string(),
            event: "postgres_changes".to_string(),
            payload: serde_json::json!({
                "table": "tasks",
                "event_type": "UPDATE",
                "old_record": {"id": "1", "status": "todo"},
                "new_record": {"id": "1", "status": "in_progress"}
            }),
            msg_ref: Some("1".to_string()),
        };

        let change = msg.parse_change().expect("Should parse change");
        assert_eq!(change.table, "tasks");
        assert_eq!(change.event_type, RealtimeEventType::Update);
    }
}
