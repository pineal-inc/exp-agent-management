use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Application mode: Solo (local only) or Team (Supabase-backed)
#[derive(Debug, Clone, Default)]
pub enum AppMode {
    /// Local-only mode, no team features
    #[default]
    Solo,
    /// Team mode with Supabase backend
    Team {
        team_id: Uuid,
        project_id: Uuid,
        user_identifier: String,
    },
}

/// Team entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Team {
    pub id: Uuid,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    pub invite_code: String,
    #[serde(default)]
    pub settings: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Team member entity
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamMember {
    pub id: Uuid,
    pub team_id: Uuid,
    pub user_identifier: String,
    #[serde(default)]
    pub display_name: Option<String>,
    pub role: TeamRole,
    pub joined_at: DateTime<Utc>,
}

/// Team member role
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum TeamRole {
    Admin,
    #[default]
    Member,
}

/// Project entity (Supabase version)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteProject {
    pub id: Uuid,
    pub team_id: Uuid,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub repo_url: Option<String>,
    #[serde(default)]
    pub settings: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Story entity (user story)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Story {
    pub id: Uuid,
    pub project_id: Uuid,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub as_a: Option<String>,
    #[serde(default)]
    pub i_want: Option<String>,
    #[serde(default)]
    pub so_that: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: serde_json::Value,
    pub status: StoryStatus,
    #[serde(default)]
    pub story_points: Option<i32>,
    #[serde(default)]
    pub priority: i32,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Story status
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum StoryStatus {
    #[default]
    Backlog,
    Ready,
    InProgress,
    Done,
    Cancelled,
}

/// Remote task entity (Supabase version)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteTask {
    pub id: Uuid,
    pub project_id: Uuid,
    #[serde(default)]
    pub story_id: Option<Uuid>,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "type")]
    pub task_type: TaskType,
    pub status: RemoteTaskStatus,
    #[serde(default)]
    pub assigned_to: Option<String>,
    #[serde(default)]
    pub branch_name: Option<String>,
    #[serde(default)]
    pub metadata: serde_json::Value,
    pub created_by: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Task type
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum TaskType {
    #[default]
    Feature,
    Bug,
    Enhancement,
    Spike,
    Chore,
}

/// Remote task status
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum RemoteTaskStatus {
    #[default]
    Todo,
    InProgress,
    InReview,
    Done,
    Blocked,
}

/// Task dependency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteTaskDependency {
    pub task_id: Uuid,
    pub depends_on_id: Uuid,
    pub created_at: DateTime<Utc>,
}

/// Create team request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTeamRequest {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
}

/// Create project request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateProjectRequest {
    pub team_id: Uuid,
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub repo_url: Option<String>,
}

/// Create story request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateStoryRequest {
    pub project_id: Uuid,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub as_a: Option<String>,
    #[serde(default)]
    pub i_want: Option<String>,
    #[serde(default)]
    pub so_that: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: Option<serde_json::Value>,
    #[serde(default)]
    pub story_points: Option<i32>,
    #[serde(default)]
    pub priority: Option<i32>,
    pub created_by: String,
}

/// Create task request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTaskRequest {
    pub project_id: Uuid,
    #[serde(default)]
    pub story_id: Option<Uuid>,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(rename = "type", default)]
    pub task_type: Option<TaskType>,
    pub created_by: String,
}

/// Update task request
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateTaskRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<RemoteTaskStatus>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub assigned_to: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub branch_name: Option<String>,
}

/// Update story request
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateStoryRequest {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub as_a: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub i_want: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub so_that: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub acceptance_criteria: Option<serde_json::Value>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<StoryStatus>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub story_points: Option<i32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub priority: Option<i32>,
}

/// Join team request
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinTeamRequest {
    pub invite_code: String,
    #[serde(default)]
    pub display_name: Option<String>,
}
