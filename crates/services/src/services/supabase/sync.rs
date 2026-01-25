use anyhow::{Context, Result};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

use super::client::SupabaseClient;
use super::models::{RemoteTaskStatus, UpdateTaskRequest};

/// Maximum number of items to keep in the sync queue
const MAX_QUEUE_SIZE: usize = 100;

/// A queued sync operation for offline support
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOperation {
    pub id: Uuid,
    pub operation_type: SyncOperationType,
    pub created_at: DateTime<Utc>,
    pub retry_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum SyncOperationType {
    UpdateTaskStatus {
        task_id: Uuid,
        status: RemoteTaskStatus,
    },
    UpdateTaskAssignment {
        task_id: Uuid,
        assigned_to: Option<String>,
    },
    UpdateTaskBranch {
        task_id: Uuid,
        branch_name: String,
    },
}

/// Service for syncing task state with Supabase
#[derive(Clone)]
pub struct SyncService {
    client: Option<SupabaseClient>,
    queue: Arc<RwLock<VecDeque<SyncOperation>>>,
}

impl SyncService {
    /// Create a new sync service
    pub fn new(client: Option<SupabaseClient>) -> Self {
        Self {
            client,
            queue: Arc::new(RwLock::new(VecDeque::new())),
        }
    }

    /// Check if the service is online (has a Supabase client)
    pub fn is_online(&self) -> bool {
        self.client.is_some()
    }

    /// Sync a task status change to Supabase
    pub async fn sync_task_status(&self, task_id: Uuid, status: RemoteTaskStatus) -> Result<()> {
        let operation = SyncOperation {
            id: Uuid::new_v4(),
            operation_type: SyncOperationType::UpdateTaskStatus { task_id, status },
            created_at: Utc::now(),
            retry_count: 0,
        };

        self.execute_or_queue(operation).await
    }

    /// Sync a task assignment change to Supabase
    pub async fn sync_task_assignment(
        &self,
        task_id: Uuid,
        assigned_to: Option<String>,
    ) -> Result<()> {
        let operation = SyncOperation {
            id: Uuid::new_v4(),
            operation_type: SyncOperationType::UpdateTaskAssignment {
                task_id,
                assigned_to,
            },
            created_at: Utc::now(),
            retry_count: 0,
        };

        self.execute_or_queue(operation).await
    }

    /// Sync a task branch name change to Supabase
    pub async fn sync_task_branch(&self, task_id: Uuid, branch_name: String) -> Result<()> {
        let operation = SyncOperation {
            id: Uuid::new_v4(),
            operation_type: SyncOperationType::UpdateTaskBranch {
                task_id,
                branch_name,
            },
            created_at: Utc::now(),
            retry_count: 0,
        };

        self.execute_or_queue(operation).await
    }

    /// Execute an operation immediately or queue it for later
    async fn execute_or_queue(&self, operation: SyncOperation) -> Result<()> {
        if let Some(ref client) = self.client {
            match self.execute_operation(client, &operation).await {
                Ok(()) => {
                    tracing::debug!("Sync operation {:?} completed", operation.id);
                    Ok(())
                }
                Err(e) => {
                    tracing::warn!(
                        "Sync operation {:?} failed, queueing: {}",
                        operation.id,
                        e
                    );
                    self.queue_operation(operation).await;
                    Ok(()) // Don't fail the caller, just queue
                }
            }
        } else {
            tracing::debug!("Supabase offline, queueing sync operation {:?}", operation.id);
            self.queue_operation(operation).await;
            Ok(())
        }
    }

    /// Execute a single sync operation
    async fn execute_operation(
        &self,
        client: &SupabaseClient,
        operation: &SyncOperation,
    ) -> Result<()> {
        match &operation.operation_type {
            SyncOperationType::UpdateTaskStatus { task_id, status } => {
                let request = UpdateTaskRequest {
                    status: Some(status.clone()),
                    ..Default::default()
                };
                client
                    .update_task(*task_id, request, None)
                    .await
                    .context("Failed to update task status")?;
            }
            SyncOperationType::UpdateTaskAssignment {
                task_id,
                assigned_to,
            } => {
                let request = UpdateTaskRequest {
                    assigned_to: assigned_to.clone(),
                    ..Default::default()
                };
                client
                    .update_task(*task_id, request, None)
                    .await
                    .context("Failed to update task assignment")?;
            }
            SyncOperationType::UpdateTaskBranch {
                task_id,
                branch_name,
            } => {
                let request = UpdateTaskRequest {
                    branch_name: Some(branch_name.clone()),
                    ..Default::default()
                };
                client
                    .update_task(*task_id, request, None)
                    .await
                    .context("Failed to update task branch")?;
            }
        }
        Ok(())
    }

    /// Queue an operation for later execution
    async fn queue_operation(&self, operation: SyncOperation) {
        let mut queue = self.queue.write().await;

        // Limit queue size
        while queue.len() >= MAX_QUEUE_SIZE {
            if let Some(old) = queue.pop_front() {
                tracing::warn!("Dropping old sync operation {:?} due to queue overflow", old.id);
            }
        }

        queue.push_back(operation);
    }

    /// Process all queued operations
    pub async fn process_queue(&self) -> Result<usize> {
        let Some(ref client) = self.client else {
            return Ok(0);
        };

        let mut processed = 0;
        let mut failed = Vec::new();

        // Take all items from the queue
        let operations: Vec<SyncOperation> = {
            let mut queue = self.queue.write().await;
            queue.drain(..).collect()
        };

        for mut operation in operations {
            match self.execute_operation(client, &operation).await {
                Ok(()) => {
                    processed += 1;
                    tracing::debug!("Processed queued sync operation {:?}", operation.id);
                }
                Err(e) => {
                    operation.retry_count += 1;
                    if operation.retry_count < 3 {
                        tracing::warn!(
                            "Queued sync operation {:?} failed (attempt {}): {}",
                            operation.id,
                            operation.retry_count,
                            e
                        );
                        failed.push(operation);
                    } else {
                        tracing::error!(
                            "Queued sync operation {:?} permanently failed after {} attempts: {}",
                            operation.id,
                            operation.retry_count,
                            e
                        );
                    }
                }
            }
        }

        // Re-queue failed operations
        if !failed.is_empty() {
            let mut queue = self.queue.write().await;
            for op in failed {
                queue.push_back(op);
            }
        }

        Ok(processed)
    }

    /// Get the number of queued operations
    pub async fn queue_length(&self) -> usize {
        self.queue.read().await.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_sync_service_offline_queuing() {
        let service = SyncService::new(None);

        // Should queue operations when offline
        let result = service
            .sync_task_status(Uuid::new_v4(), RemoteTaskStatus::InProgress)
            .await;
        assert!(result.is_ok());
        assert_eq!(service.queue_length().await, 1);
    }

    #[tokio::test]
    async fn test_queue_overflow() {
        let service = SyncService::new(None);

        // Fill queue beyond capacity
        for _ in 0..MAX_QUEUE_SIZE + 10 {
            let _ = service
                .sync_task_status(Uuid::new_v4(), RemoteTaskStatus::Todo)
                .await;
        }

        // Should not exceed max size
        assert_eq!(service.queue_length().await, MAX_QUEUE_SIZE);
    }
}
