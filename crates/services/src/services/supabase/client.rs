use anyhow::{Context, Result};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{de::DeserializeOwned, Serialize};
use uuid::Uuid;

use super::models::*;

/// Supabase client for team collaboration features
#[derive(Debug, Clone)]
pub struct SupabaseClient {
    base_url: String,
    #[allow(dead_code)]
    anon_key: String,
    http: reqwest::Client,
}

impl SupabaseClient {
    /// Create a new Supabase client
    pub fn new(base_url: impl Into<String>, anon_key: impl Into<String>) -> Result<Self> {
        let base_url = base_url.into();
        let anon_key = anon_key.into();

        let mut headers = HeaderMap::new();
        headers.insert(
            "apikey",
            HeaderValue::from_str(&anon_key).context("Invalid anon key")?,
        );
        headers.insert(
            CONTENT_TYPE,
            HeaderValue::from_static("application/json"),
        );

        let http = reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .context("Failed to create HTTP client")?;

        Ok(Self {
            base_url,
            anon_key,
            http,
        })
    }

    /// Get the REST API URL
    fn rest_url(&self, table: &str) -> String {
        format!("{}/rest/v1/{}", self.base_url, table)
    }

    /// Make an authenticated request with user JWT
    fn auth_headers(&self, jwt: Option<&str>) -> HeaderMap {
        let mut headers = HeaderMap::new();
        if let Some(token) = jwt
            && let Ok(value) = HeaderValue::from_str(&format!("Bearer {}", token))
        {
            headers.insert(AUTHORIZATION, value);
        }
        headers
    }

    /// Execute a SELECT query
    async fn select<T: DeserializeOwned>(
        &self,
        table: &str,
        query: &[(&str, &str)],
        jwt: Option<&str>,
    ) -> Result<Vec<T>> {
        let url = self.rest_url(table);
        let response = self
            .http
            .get(&url)
            .query(query)
            .headers(self.auth_headers(jwt))
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Supabase request failed: {} - {}", status, body);
        }

        response
            .json()
            .await
            .context("Failed to parse response")
    }

    /// Execute an INSERT query
    async fn insert<T: Serialize, R: DeserializeOwned>(
        &self,
        table: &str,
        data: &T,
        jwt: Option<&str>,
    ) -> Result<R> {
        let url = self.rest_url(table);
        let response = self
            .http
            .post(&url)
            .headers(self.auth_headers(jwt))
            .header("Prefer", "return=representation")
            .json(data)
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Supabase insert failed: {} - {}", status, body);
        }

        let items: Vec<R> = response
            .json()
            .await
            .context("Failed to parse response")?;

        items.into_iter().next().context("No item returned")
    }

    /// Execute an UPDATE query
    async fn update<T: Serialize, R: DeserializeOwned>(
        &self,
        table: &str,
        id: Uuid,
        data: &T,
        jwt: Option<&str>,
    ) -> Result<R> {
        let url = self.rest_url(table);
        let response = self
            .http
            .patch(&url)
            .query(&[("id", format!("eq.{}", id))])
            .headers(self.auth_headers(jwt))
            .header("Prefer", "return=representation")
            .json(data)
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Supabase update failed: {} - {}", status, body);
        }

        let items: Vec<R> = response
            .json()
            .await
            .context("Failed to parse response")?;

        items.into_iter().next().context("No item returned")
    }

    /// Execute a DELETE query
    async fn delete(&self, table: &str, id: Uuid, jwt: Option<&str>) -> Result<()> {
        let url = self.rest_url(table);
        let response = self
            .http
            .delete(&url)
            .query(&[("id", format!("eq.{}", id))])
            .headers(self.auth_headers(jwt))
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Supabase delete failed: {} - {}", status, body);
        }

        Ok(())
    }

    // ============ Teams ============

    /// Get team by ID
    pub async fn get_team(&self, id: Uuid, jwt: Option<&str>) -> Result<Option<Team>> {
        let teams: Vec<Team> = self
            .select("teams", &[("id", &format!("eq.{}", id))], jwt)
            .await?;
        Ok(teams.into_iter().next())
    }

    /// Get team by invite code
    pub async fn get_team_by_invite_code(
        &self,
        invite_code: &str,
        jwt: Option<&str>,
    ) -> Result<Option<Team>> {
        let teams: Vec<Team> = self
            .select("teams", &[("invite_code", &format!("eq.{}", invite_code))], jwt)
            .await?;
        Ok(teams.into_iter().next())
    }

    /// Create a new team
    pub async fn create_team(&self, request: CreateTeamRequest, jwt: Option<&str>) -> Result<Team> {
        let invite_code = generate_invite_code();
        let data = serde_json::json!({
            "name": request.name,
            "description": request.description,
            "invite_code": invite_code,
        });
        self.insert("teams", &data, jwt).await
    }

    // ============ Team Members ============

    /// Get team members
    pub async fn get_team_members(
        &self,
        team_id: Uuid,
        jwt: Option<&str>,
    ) -> Result<Vec<TeamMember>> {
        self.select("team_members", &[("team_id", &format!("eq.{}", team_id))], jwt)
            .await
    }

    /// Add team member
    pub async fn add_team_member(
        &self,
        team_id: Uuid,
        user_identifier: &str,
        display_name: Option<&str>,
        role: TeamRole,
        jwt: Option<&str>,
    ) -> Result<TeamMember> {
        let data = serde_json::json!({
            "team_id": team_id,
            "user_identifier": user_identifier,
            "display_name": display_name,
            "role": role,
        });
        self.insert("team_members", &data, jwt).await
    }

    /// Join a team using an invite code
    pub async fn join_team_by_invite_code(
        &self,
        invite_code: &str,
        user_identifier: &str,
        display_name: Option<&str>,
        jwt: Option<&str>,
    ) -> Result<(Team, TeamMember)> {
        // Find the team by invite code
        let team = self
            .get_team_by_invite_code(invite_code, jwt)
            .await?
            .context("Invalid invite code")?;

        // Check if user is already a member
        let existing_members = self.get_team_members(team.id, jwt).await?;
        if existing_members
            .iter()
            .any(|m| m.user_identifier == user_identifier)
        {
            anyhow::bail!("User is already a member of this team");
        }

        // Add the user as a member
        let member = self
            .add_team_member(team.id, user_identifier, display_name, TeamRole::Member, jwt)
            .await?;

        Ok((team, member))
    }

    /// Update team details
    pub async fn update_team(
        &self,
        id: Uuid,
        name: Option<&str>,
        description: Option<&str>,
        jwt: Option<&str>,
    ) -> Result<Team> {
        let mut data = serde_json::Map::new();
        if let Some(n) = name {
            data.insert("name".to_string(), serde_json::Value::String(n.to_string()));
        }
        if let Some(d) = description {
            data.insert("description".to_string(), serde_json::Value::String(d.to_string()));
        }
        self.update("teams", id, &serde_json::Value::Object(data), jwt)
            .await
    }

    /// Remove a team member
    pub async fn remove_team_member(
        &self,
        team_id: Uuid,
        user_identifier: &str,
        jwt: Option<&str>,
    ) -> Result<()> {
        let url = self.rest_url("team_members");
        let response = self
            .http
            .delete(&url)
            .query(&[
                ("team_id", format!("eq.{}", team_id)),
                ("user_identifier", format!("eq.{}", user_identifier)),
            ])
            .headers(self.auth_headers(jwt))
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Supabase delete failed: {} - {}", status, body);
        }

        Ok(())
    }

    /// Update team member role
    pub async fn update_team_member_role(
        &self,
        team_id: Uuid,
        user_identifier: &str,
        role: TeamRole,
        jwt: Option<&str>,
    ) -> Result<TeamMember> {
        let url = self.rest_url("team_members");
        let response = self
            .http
            .patch(&url)
            .query(&[
                ("team_id", format!("eq.{}", team_id)),
                ("user_identifier", format!("eq.{}", user_identifier)),
            ])
            .headers(self.auth_headers(jwt))
            .header("Prefer", "return=representation")
            .json(&serde_json::json!({ "role": role }))
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Supabase update failed: {} - {}", status, body);
        }

        let items: Vec<TeamMember> = response
            .json()
            .await
            .context("Failed to parse response")?;

        items.into_iter().next().context("No member found")
    }

    // ============ Projects ============

    /// Get projects for a team
    pub async fn get_projects(
        &self,
        team_id: Uuid,
        jwt: Option<&str>,
    ) -> Result<Vec<RemoteProject>> {
        self.select("projects", &[("team_id", &format!("eq.{}", team_id))], jwt)
            .await
    }

    /// Get project by ID
    pub async fn get_project(&self, id: Uuid, jwt: Option<&str>) -> Result<Option<RemoteProject>> {
        let projects: Vec<RemoteProject> = self
            .select("projects", &[("id", &format!("eq.{}", id))], jwt)
            .await?;
        Ok(projects.into_iter().next())
    }

    /// Create a new project
    pub async fn create_project(
        &self,
        request: CreateProjectRequest,
        jwt: Option<&str>,
    ) -> Result<RemoteProject> {
        self.insert("projects", &request, jwt).await
    }

    // ============ Stories ============

    /// Get stories for a project
    pub async fn get_stories(&self, project_id: Uuid, jwt: Option<&str>) -> Result<Vec<Story>> {
        self.select("stories", &[("project_id", &format!("eq.{}", project_id))], jwt)
            .await
    }

    /// Get story by ID
    pub async fn get_story(&self, id: Uuid, jwt: Option<&str>) -> Result<Option<Story>> {
        let stories: Vec<Story> = self
            .select("stories", &[("id", &format!("eq.{}", id))], jwt)
            .await?;
        Ok(stories.into_iter().next())
    }

    /// Create a new story
    pub async fn create_story(
        &self,
        request: CreateStoryRequest,
        jwt: Option<&str>,
    ) -> Result<Story> {
        self.insert("stories", &request, jwt).await
    }

    /// Update a story
    pub async fn update_story(
        &self,
        id: Uuid,
        request: UpdateStoryRequest,
        jwt: Option<&str>,
    ) -> Result<Story> {
        self.update("stories", id, &request, jwt).await
    }

    /// Delete a story
    pub async fn delete_story(&self, id: Uuid, jwt: Option<&str>) -> Result<()> {
        self.delete("stories", id, jwt).await
    }

    /// Get tasks for a story
    pub async fn get_story_tasks(
        &self,
        story_id: Uuid,
        jwt: Option<&str>,
    ) -> Result<Vec<RemoteTask>> {
        self.get_tasks_for_story(story_id, jwt).await
    }

    // ============ Tasks ============

    /// Get tasks for a project
    pub async fn get_tasks(
        &self,
        project_id: Uuid,
        jwt: Option<&str>,
    ) -> Result<Vec<RemoteTask>> {
        self.select("tasks", &[("project_id", &format!("eq.{}", project_id))], jwt)
            .await
    }

    /// Get tasks for a story
    pub async fn get_tasks_for_story(
        &self,
        story_id: Uuid,
        jwt: Option<&str>,
    ) -> Result<Vec<RemoteTask>> {
        self.select("tasks", &[("story_id", &format!("eq.{}", story_id))], jwt)
            .await
    }

    /// Get task by ID
    pub async fn get_task(&self, id: Uuid, jwt: Option<&str>) -> Result<Option<RemoteTask>> {
        let tasks: Vec<RemoteTask> = self
            .select("tasks", &[("id", &format!("eq.{}", id))], jwt)
            .await?;
        Ok(tasks.into_iter().next())
    }

    /// Create a new task
    pub async fn create_task(
        &self,
        request: CreateTaskRequest,
        jwt: Option<&str>,
    ) -> Result<RemoteTask> {
        self.insert("tasks", &request, jwt).await
    }

    /// Update a task
    pub async fn update_task(
        &self,
        id: Uuid,
        request: UpdateTaskRequest,
        jwt: Option<&str>,
    ) -> Result<RemoteTask> {
        self.update("tasks", id, &request, jwt).await
    }

    /// Delete a task
    pub async fn delete_task(&self, id: Uuid, jwt: Option<&str>) -> Result<()> {
        self.delete("tasks", id, jwt).await
    }

    // ============ Task Dependencies ============

    /// Get dependencies for a task
    pub async fn get_task_dependencies(
        &self,
        task_id: Uuid,
        jwt: Option<&str>,
    ) -> Result<Vec<RemoteTaskDependency>> {
        self.select(
            "task_dependencies",
            &[("task_id", &format!("eq.{}", task_id))],
            jwt,
        )
        .await
    }

    /// Add a task dependency
    pub async fn add_task_dependency(
        &self,
        task_id: Uuid,
        depends_on_id: Uuid,
        jwt: Option<&str>,
    ) -> Result<RemoteTaskDependency> {
        let data = serde_json::json!({
            "task_id": task_id,
            "depends_on_id": depends_on_id,
        });
        self.insert("task_dependencies", &data, jwt).await
    }

    /// Remove a task dependency
    pub async fn remove_task_dependency(
        &self,
        task_id: Uuid,
        depends_on_id: Uuid,
        jwt: Option<&str>,
    ) -> Result<()> {
        let url = self.rest_url("task_dependencies");
        let response = self
            .http
            .delete(&url)
            .query(&[
                ("task_id", format!("eq.{}", task_id)),
                ("depends_on_id", format!("eq.{}", depends_on_id)),
            ])
            .headers(self.auth_headers(jwt))
            .send()
            .await
            .context("Failed to send request")?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            anyhow::bail!("Supabase delete failed: {} - {}", status, body);
        }

        Ok(())
    }
}

/// Generate a random invite code
fn generate_invite_code() -> String {
    use rand::Rng;
    const CHARSET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    const LEN: usize = 8;

    let mut rng = rand::rng();
    (0..LEN)
        .map(|_| {
            let idx = rng.random_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_invite_code() {
        let code = generate_invite_code();
        assert_eq!(code.len(), 8);
        assert!(code.chars().all(|c| c.is_ascii_alphanumeric()));
    }

    #[test]
    fn test_app_mode_default() {
        let mode = AppMode::default();
        assert!(matches!(mode, AppMode::Solo));
    }

    #[test]
    fn test_rest_url_format() {
        // Test the URL format logic without creating a full client
        let base_url = "https://test.supabase.co";
        let table = "teams";
        let expected = format!("{}/rest/v1/{}", base_url, table);
        assert_eq!(expected, "https://test.supabase.co/rest/v1/teams");
    }
}
