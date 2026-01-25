use anyhow::{Context, Result};
use std::path::Path;
use tokio::fs;

use super::models::{RemoteTask, Story};

/// Service for generating context files for AI coding agents
pub struct FileGenerator;

impl FileGenerator {
    /// Generate CLAUDE.md content from story and task information
    pub fn generate_claude_md(
        story: Option<&Story>,
        task: &RemoteTask,
        additional_context: Option<&str>,
    ) -> String {
        let mut content = String::new();

        // Header
        content.push_str("# Task Context\n\n");

        // Task information
        content.push_str("## Current Task\n\n");
        content.push_str(&format!("**Title:** {}\n", task.title));
        content.push_str(&format!("**Type:** {:?}\n", task.task_type));
        content.push_str(&format!("**Status:** {:?}\n", task.status));

        if let Some(desc) = &task.description {
            content.push_str(&format!("\n**Description:**\n{}\n", desc));
        }

        if let Some(branch) = &task.branch_name {
            content.push_str(&format!("\n**Branch:** `{}`\n", branch));
        }

        // Story information (if available)
        if let Some(story) = story {
            content.push_str("\n## User Story\n\n");

            // User story format
            if story.as_a.is_some() || story.i_want.is_some() || story.so_that.is_some() {
                if let Some(as_a) = &story.as_a {
                    content.push_str(&format!("**As a** {}\n", as_a));
                }
                if let Some(i_want) = &story.i_want {
                    content.push_str(&format!("**I want** {}\n", i_want));
                }
                if let Some(so_that) = &story.so_that {
                    content.push_str(&format!("**So that** {}\n", so_that));
                }
                content.push('\n');
            }

            if let Some(desc) = &story.description {
                content.push_str(&format!("**Story Description:**\n{}\n\n", desc));
            }

            // Acceptance criteria
            if !story.acceptance_criteria.is_null()
                && story.acceptance_criteria != serde_json::Value::Object(Default::default())
            {
                content.push_str("### Acceptance Criteria\n\n");
                if let Some(obj) = story.acceptance_criteria.as_object() {
                    for (key, value) in obj {
                        content.push_str(&format!("**{}:**\n", key));
                        if let Some(arr) = value.as_array() {
                            for item in arr {
                                if let Some(s) = item.as_str() {
                                    content.push_str(&format!("- {}\n", s));
                                }
                            }
                        } else if let Some(s) = value.as_str() {
                            content.push_str(&format!("- {}\n", s));
                        }
                        content.push('\n');
                    }
                }
            }
        }

        // Additional context
        if let Some(ctx) = additional_context {
            content.push_str("\n## Additional Context\n\n");
            content.push_str(ctx);
            content.push('\n');
        }

        // Guidelines
        content.push_str("\n---\n\n");
        content.push_str("## Guidelines\n\n");
        content.push_str("- Focus on implementing the task as described\n");
        content.push_str("- Follow the acceptance criteria if provided\n");
        content.push_str("- Write clean, maintainable code\n");
        content.push_str("- Include appropriate tests\n");
        content.push_str("- Update documentation as needed\n");

        content
    }

    /// Write CLAUDE.md to a workspace directory
    pub async fn write_claude_md(
        workspace_path: &Path,
        story: Option<&Story>,
        task: &RemoteTask,
        additional_context: Option<&str>,
    ) -> Result<()> {
        let content = Self::generate_claude_md(story, task, additional_context);
        let file_path = workspace_path.join("CLAUDE.md");

        fs::write(&file_path, content)
            .await
            .with_context(|| format!("Failed to write CLAUDE.md to {}", file_path.display()))?;

        tracing::info!("Generated CLAUDE.md at {}", file_path.display());
        Ok(())
    }

    /// Generate a simple task summary for quick reference
    pub fn generate_task_summary(task: &RemoteTask) -> String {
        let mut summary = format!("Task: {}\n", task.title);
        summary.push_str(&format!("Type: {:?}\n", task.task_type));

        if let Some(desc) = &task.description {
            let short_desc = if desc.len() > 200 {
                format!("{}...", &desc[..200])
            } else {
                desc.clone()
            };
            summary.push_str(&format!("Description: {}\n", short_desc));
        }

        summary
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::supabase::models::{StoryStatus, TaskType, RemoteTaskStatus};
    use chrono::Utc;
    use uuid::Uuid;

    fn create_test_task() -> RemoteTask {
        RemoteTask {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            story_id: None,
            title: "Implement login feature".to_string(),
            description: Some("Add a login form with email and password fields".to_string()),
            task_type: TaskType::Feature,
            status: RemoteTaskStatus::InProgress,
            assigned_to: Some("dev@example.com".to_string()),
            branch_name: Some("feature/login".to_string()),
            metadata: serde_json::json!({}),
            created_by: "pm@example.com".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    fn create_test_story() -> Story {
        Story {
            id: Uuid::new_v4(),
            project_id: Uuid::new_v4(),
            title: "User Authentication".to_string(),
            description: Some("Enable users to securely log in to the application".to_string()),
            as_a: Some("registered user".to_string()),
            i_want: Some("to log in with my email and password".to_string()),
            so_that: Some("I can access my personal data".to_string()),
            acceptance_criteria: serde_json::json!({
                "AC1": ["User can enter email", "User can enter password", "User sees error for invalid credentials"],
                "AC2": ["User is redirected to dashboard on success"]
            }),
            status: StoryStatus::InProgress,
            story_points: Some(5),
            priority: 1,
            created_by: "pm@example.com".to_string(),
            created_at: Utc::now(),
            updated_at: Utc::now(),
        }
    }

    #[test]
    fn test_generate_claude_md_with_story() {
        let task = create_test_task();
        let story = create_test_story();

        let content = FileGenerator::generate_claude_md(Some(&story), &task, None);

        assert!(content.contains("# Task Context"));
        assert!(content.contains("Implement login feature"));
        assert!(content.contains("As a** registered user"));
        assert!(content.contains("Acceptance Criteria"));
    }

    #[test]
    fn test_generate_claude_md_without_story() {
        let task = create_test_task();

        let content = FileGenerator::generate_claude_md(None, &task, None);

        assert!(content.contains("# Task Context"));
        assert!(content.contains("Implement login feature"));
        assert!(!content.contains("User Story"));
    }

    #[test]
    fn test_generate_claude_md_with_additional_context() {
        let task = create_test_task();

        let content = FileGenerator::generate_claude_md(
            None,
            &task,
            Some("Use the existing auth module as a reference"),
        );

        assert!(content.contains("Additional Context"));
        assert!(content.contains("Use the existing auth module"));
    }

    #[test]
    fn test_generate_task_summary() {
        let task = create_test_task();

        let summary = FileGenerator::generate_task_summary(&task);

        assert!(summary.contains("Task: Implement login feature"));
        assert!(summary.contains("Type: Feature"));
    }
}
