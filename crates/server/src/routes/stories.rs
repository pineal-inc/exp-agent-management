use axum::{
    Router,
    extract::{Json, Path, Query, State},
    http::StatusCode,
    response::Json as ResponseJson,
    routing::get,
};
use deployment::Deployment;
use serde::Deserialize;
use services::services::supabase::{
    CreateStoryRequest, RemoteTask, Story, UpdateStoryRequest,
};
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

#[derive(Debug, Deserialize)]
pub struct StoriesQuery {
    pub project_id: Uuid,
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/stories", get(list_stories).post(create_story))
        .route(
            "/stories/{id}",
            get(get_story).put(update_story).delete(delete_story),
        )
        .route("/stories/{id}/tasks", get(get_story_tasks))
}

/// List all stories for a project
async fn list_stories(
    State(deployment): State<DeploymentImpl>,
    Query(query): Query<StoriesQuery>,
) -> Result<ResponseJson<ApiResponse<Vec<Story>>>, ApiError> {
    let supabase = deployment
        .supabase_client()
        .ok_or_else(|| ApiError::ServiceUnavailable("Supabase not configured".to_string()))?;

    let stories = supabase
        .get_stories(query.project_id, None)
        .await
        .map_err(|e| ApiError::InternalServer(e.to_string()))?;

    Ok(ResponseJson(ApiResponse::success(stories)))
}

/// Create a new story
async fn create_story(
    State(deployment): State<DeploymentImpl>,
    Json(request): Json<CreateStoryRequest>,
) -> Result<ResponseJson<ApiResponse<Story>>, ApiError> {
    let supabase = deployment
        .supabase_client()
        .ok_or_else(|| ApiError::ServiceUnavailable("Supabase not configured".to_string()))?;

    let story = supabase
        .create_story(request.clone(), None)
        .await
        .map_err(|e| ApiError::InternalServer(e.to_string()))?;

    deployment
        .track_if_analytics_allowed(
            "story_created",
            serde_json::json!({
                "story_id": story.id.to_string(),
                "project_id": request.project_id.to_string(),
            }),
        )
        .await;

    Ok(ResponseJson(ApiResponse::success(story)))
}

/// Get a story by ID
async fn get_story(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Story>>, ApiError> {
    let supabase = deployment
        .supabase_client()
        .ok_or_else(|| ApiError::ServiceUnavailable("Supabase not configured".to_string()))?;

    let story = supabase
        .get_story(id, None)
        .await
        .map_err(|e| ApiError::InternalServer(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("Story not found".to_string()))?;

    Ok(ResponseJson(ApiResponse::success(story)))
}

/// Update a story
async fn update_story(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
    Json(request): Json<UpdateStoryRequest>,
) -> Result<ResponseJson<ApiResponse<Story>>, ApiError> {
    let supabase = deployment
        .supabase_client()
        .ok_or_else(|| ApiError::ServiceUnavailable("Supabase not configured".to_string()))?;

    let story = supabase
        .update_story(id, request, None)
        .await
        .map_err(|e| ApiError::InternalServer(e.to_string()))?;

    Ok(ResponseJson(ApiResponse::success(story)))
}

/// Delete a story
async fn delete_story(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
) -> Result<StatusCode, ApiError> {
    let supabase = deployment
        .supabase_client()
        .ok_or_else(|| ApiError::ServiceUnavailable("Supabase not configured".to_string()))?;

    supabase
        .delete_story(id, None)
        .await
        .map_err(|e| ApiError::InternalServer(e.to_string()))?;

    deployment
        .track_if_analytics_allowed(
            "story_deleted",
            serde_json::json!({
                "story_id": id.to_string(),
            }),
        )
        .await;

    Ok(StatusCode::NO_CONTENT)
}

/// Get tasks associated with a story
async fn get_story_tasks(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Vec<RemoteTask>>>, ApiError> {
    let supabase = deployment
        .supabase_client()
        .ok_or_else(|| ApiError::ServiceUnavailable("Supabase not configured".to_string()))?;

    let tasks = supabase
        .get_story_tasks(id, None)
        .await
        .map_err(|e| ApiError::InternalServer(e.to_string()))?;

    Ok(ResponseJson(ApiResponse::success(tasks)))
}
