use axum::{
    Router,
    extract::{Json, Path, State},
    response::Json as ResponseJson,
    routing::{get, post},
};
use deployment::Deployment;
use serde::{Deserialize, Serialize};
use services::services::supabase::{
    CreateTeamRequest, JoinTeamRequest, Team, TeamMember, TeamRole,
};
use utils::response::ApiResponse;
use uuid::Uuid;

use crate::{DeploymentImpl, error::ApiError};

/// Response for team creation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTeamResponse {
    pub team: Team,
    pub member: TeamMember,
}

/// Response for joining a team
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JoinTeamResponse {
    pub team: Team,
    pub member: TeamMember,
}

/// Team member info for listing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamMemberInfo {
    pub id: Uuid,
    pub user_identifier: String,
    pub display_name: Option<String>,
    pub role: TeamRole,
    pub joined_at: String,
}

pub fn router() -> Router<DeploymentImpl> {
    Router::new()
        .route("/teams", post(create_team))
        .route("/teams/join", post(join_team))
        .route("/teams/{id}", get(get_team))
        .route("/teams/{id}/members", get(get_team_members))
}

/// Create a new team
async fn create_team(
    State(deployment): State<DeploymentImpl>,
    Json(request): Json<CreateTeamRequest>,
) -> Result<ResponseJson<ApiResponse<CreateTeamResponse>>, ApiError> {
    let supabase = deployment
        .supabase_client()
        .ok_or_else(|| ApiError::ServiceUnavailable("Supabase not configured".to_string()))?;

    // Get user identifier
    let user_identifier = deployment
        .get_user_identifier()
        .await
        .ok_or_else(|| ApiError::Unauthorized)?;

    // Create the team
    let team = supabase
        .create_team(request, None)
        .await
        .map_err(|e| ApiError::InternalServer(e.to_string()))?;

    // Add creator as admin
    let member = supabase
        .add_team_member(team.id, &user_identifier, None, TeamRole::Admin, None)
        .await
        .map_err(|e| ApiError::InternalServer(e.to_string()))?;

    deployment
        .track_if_analytics_allowed(
            "team_created",
            serde_json::json!({
                "team_id": team.id.to_string(),
                "team_name": team.name,
            }),
        )
        .await;

    Ok(ResponseJson(ApiResponse::success(CreateTeamResponse {
        team,
        member,
    })))
}

/// Join an existing team using invite code
async fn join_team(
    State(deployment): State<DeploymentImpl>,
    Json(request): Json<JoinTeamRequest>,
) -> Result<ResponseJson<ApiResponse<JoinTeamResponse>>, ApiError> {
    let supabase = deployment
        .supabase_client()
        .ok_or_else(|| ApiError::ServiceUnavailable("Supabase not configured".to_string()))?;

    // Get user identifier
    let user_identifier = deployment
        .get_user_identifier()
        .await
        .ok_or_else(|| ApiError::Unauthorized)?;

    // Join the team
    let (team, member) = supabase
        .join_team_by_invite_code(
            &request.invite_code,
            &user_identifier,
            request.display_name.as_deref(),
            None,
        )
        .await
        .map_err(|e| {
            if e.to_string().contains("Invalid invite code") {
                ApiError::NotFound("Invalid invite code".to_string())
            } else if e.to_string().contains("already a member") {
                ApiError::Conflict("User is already a member of this team".to_string())
            } else {
                ApiError::InternalServer(e.to_string())
            }
        })?;

    deployment
        .track_if_analytics_allowed(
            "team_joined",
            serde_json::json!({
                "team_id": team.id.to_string(),
                "team_name": team.name,
            }),
        )
        .await;

    Ok(ResponseJson(ApiResponse::success(JoinTeamResponse {
        team,
        member,
    })))
}

/// Get team details
async fn get_team(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Team>>, ApiError> {
    let supabase = deployment
        .supabase_client()
        .ok_or_else(|| ApiError::ServiceUnavailable("Supabase not configured".to_string()))?;

    let team = supabase
        .get_team(id, None)
        .await
        .map_err(|e| ApiError::InternalServer(e.to_string()))?
        .ok_or_else(|| ApiError::NotFound("Team not found".to_string()))?;

    Ok(ResponseJson(ApiResponse::success(team)))
}

/// Get team members
async fn get_team_members(
    State(deployment): State<DeploymentImpl>,
    Path(id): Path<Uuid>,
) -> Result<ResponseJson<ApiResponse<Vec<TeamMemberInfo>>>, ApiError> {
    let supabase = deployment
        .supabase_client()
        .ok_or_else(|| ApiError::ServiceUnavailable("Supabase not configured".to_string()))?;

    let members = supabase
        .get_team_members(id, None)
        .await
        .map_err(|e| ApiError::InternalServer(e.to_string()))?;

    let member_infos: Vec<TeamMemberInfo> = members
        .into_iter()
        .map(|m| TeamMemberInfo {
            id: m.id,
            user_identifier: m.user_identifier,
            display_name: m.display_name,
            role: m.role,
            joined_at: m.joined_at.to_rfc3339(),
        })
        .collect();

    Ok(ResponseJson(ApiResponse::success(member_infos)))
}
