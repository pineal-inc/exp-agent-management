use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use uuid::Uuid;

use super::models::AppMode;

/// Crew configuration file structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrewConfig {
    /// Config version for migration support
    pub version: u32,
    /// Team configuration (optional for solo mode)
    #[serde(default)]
    pub team: Option<TeamConfig>,
    /// Project configuration
    #[serde(default)]
    pub project: Option<ProjectConfig>,
    /// Supabase connection settings
    #[serde(default)]
    pub supabase: Option<SupabaseConfig>,
}

/// Team configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TeamConfig {
    pub id: Uuid,
    pub name: String,
}

/// Project configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub id: Uuid,
}

/// Supabase connection settings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupabaseConfig {
    pub url: String,
    pub anon_key: String,
}

impl Default for CrewConfig {
    fn default() -> Self {
        Self {
            version: 1,
            team: None,
            project: None,
            supabase: None,
        }
    }
}

impl CrewConfig {
    /// Config file name
    pub const FILE_NAME: &'static str = "config.json";

    /// Config directory name
    pub const DIR_NAME: &'static str = ".crew";

    /// Get the path to the config file for a given project root
    pub fn config_path(project_root: &Path) -> PathBuf {
        project_root.join(Self::DIR_NAME).join(Self::FILE_NAME)
    }

    /// Get the path to the config directory for a given project root
    pub fn config_dir(project_root: &Path) -> PathBuf {
        project_root.join(Self::DIR_NAME)
    }

    /// Load config from a project directory
    pub fn load(project_root: &Path) -> Result<Option<Self>> {
        let config_path = Self::config_path(project_root);

        if !config_path.exists() {
            return Ok(None);
        }

        let content = std::fs::read_to_string(&config_path)
            .with_context(|| format!("Failed to read config file: {}", config_path.display()))?;

        let config: Self = serde_json::from_str(&content)
            .with_context(|| format!("Failed to parse config file: {}", config_path.display()))?;

        Ok(Some(config))
    }

    /// Save config to a project directory
    pub fn save(&self, project_root: &Path) -> Result<()> {
        let config_dir = Self::config_dir(project_root);
        let config_path = Self::config_path(project_root);

        // Create directory if it doesn't exist
        if !config_dir.exists() {
            std::fs::create_dir_all(&config_dir).with_context(|| {
                format!("Failed to create config directory: {}", config_dir.display())
            })?;
        }

        let content = serde_json::to_string_pretty(self)
            .context("Failed to serialize config")?;

        std::fs::write(&config_path, content)
            .with_context(|| format!("Failed to write config file: {}", config_path.display()))?;

        Ok(())
    }

    /// Check if this config represents team mode
    pub fn is_team_mode(&self) -> bool {
        self.team.is_some() && self.project.is_some() && self.supabase.is_some()
    }

    /// Convert config to AppMode
    pub fn to_app_mode(&self, user_identifier: &str) -> AppMode {
        match (&self.team, &self.project) {
            (Some(team), Some(project)) => AppMode::Team {
                team_id: team.id,
                project_id: project.id,
                user_identifier: user_identifier.to_string(),
            },
            _ => AppMode::Solo,
        }
    }

    /// Create a new team mode config
    pub fn new_team_config(
        team_id: Uuid,
        team_name: &str,
        project_id: Uuid,
        supabase_url: &str,
        supabase_anon_key: &str,
    ) -> Self {
        Self {
            version: 1,
            team: Some(TeamConfig {
                id: team_id,
                name: team_name.to_string(),
            }),
            project: Some(ProjectConfig { id: project_id }),
            supabase: Some(SupabaseConfig {
                url: supabase_url.to_string(),
                anon_key: supabase_anon_key.to_string(),
            }),
        }
    }
}

/// Detect the app mode for a given project root
pub fn detect_app_mode(project_root: &Path, user_identifier: &str) -> Result<AppMode> {
    match CrewConfig::load(project_root)? {
        Some(config) => Ok(config.to_app_mode(user_identifier)),
        None => Ok(AppMode::Solo),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn test_config_default() {
        let config = CrewConfig::default();
        assert_eq!(config.version, 1);
        assert!(config.team.is_none());
        assert!(config.project.is_none());
        assert!(config.supabase.is_none());
        assert!(!config.is_team_mode());
    }

    #[test]
    fn test_config_save_and_load() {
        let dir = tempdir().unwrap();
        let project_root = dir.path();

        let config = CrewConfig::new_team_config(
            Uuid::new_v4(),
            "Test Team",
            Uuid::new_v4(),
            "https://test.supabase.co",
            "test-anon-key",
        );

        config.save(project_root).unwrap();

        let loaded = CrewConfig::load(project_root).unwrap().unwrap();
        assert_eq!(loaded.version, config.version);
        assert!(loaded.is_team_mode());
    }

    #[test]
    fn test_config_path() {
        let project_root = Path::new("/home/user/project");
        let config_path = CrewConfig::config_path(project_root);
        assert_eq!(config_path.to_string_lossy(), "/home/user/project/.crew/config.json");
    }

    #[test]
    fn test_to_app_mode_solo() {
        let config = CrewConfig::default();
        let mode = config.to_app_mode("user@example.com");
        assert!(matches!(mode, AppMode::Solo));
    }

    #[test]
    fn test_to_app_mode_team() {
        let team_id = Uuid::new_v4();
        let project_id = Uuid::new_v4();
        let config = CrewConfig::new_team_config(
            team_id,
            "Test Team",
            project_id,
            "https://test.supabase.co",
            "test-anon-key",
        );

        let mode = config.to_app_mode("user@example.com");
        match mode {
            AppMode::Team {
                team_id: tid,
                project_id: pid,
                user_identifier,
            } => {
                assert_eq!(tid, team_id);
                assert_eq!(pid, project_id);
                assert_eq!(user_identifier, "user@example.com");
            }
            AppMode::Solo => panic!("Expected Team mode"),
        }
    }

    #[test]
    fn test_detect_app_mode_no_config() {
        let dir = tempdir().unwrap();
        let mode = detect_app_mode(dir.path(), "user@example.com").unwrap();
        assert!(matches!(mode, AppMode::Solo));
    }

    #[test]
    fn test_detect_app_mode_with_config() {
        let dir = tempdir().unwrap();
        let project_root = dir.path();

        let config = CrewConfig::new_team_config(
            Uuid::new_v4(),
            "Test Team",
            Uuid::new_v4(),
            "https://test.supabase.co",
            "test-anon-key",
        );
        config.save(project_root).unwrap();

        let mode = detect_app_mode(project_root, "user@example.com").unwrap();
        assert!(matches!(mode, AppMode::Team { .. }));
    }
}
