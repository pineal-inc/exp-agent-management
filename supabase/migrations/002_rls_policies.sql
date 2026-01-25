-- Enable Row Level Security
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE stories ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;

-- Teams: メンバーのみアクセス可能
CREATE POLICY "Team members can view their teams"
  ON teams FOR SELECT
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Admins can update teams"
  ON teams FOR UPDATE
  USING (
    id IN (
      SELECT team_id FROM team_members
      WHERE user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
      AND role = 'admin'
    )
  );

-- Team members: チームメンバーのみアクセス可能
CREATE POLICY "Team members can view other members"
  ON team_members FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Admins can manage team members"
  ON team_members FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
      AND role = 'admin'
    )
  );

-- Projects: チームメンバーのみアクセス可能
CREATE POLICY "Team members can view projects"
  ON projects FOR SELECT
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Team members can manage projects"
  ON projects FOR ALL
  USING (
    team_id IN (
      SELECT team_id FROM team_members
      WHERE user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Stories: プロジェクトのチームメンバーのみアクセス可能
CREATE POLICY "Team members can view stories"
  ON stories FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Team members can manage stories"
  ON stories FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Tasks: プロジェクトのチームメンバーのみアクセス可能
CREATE POLICY "Team members can view tasks"
  ON tasks FOR SELECT
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Team members can manage tasks"
  ON tasks FOR ALL
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Task dependencies: タスクと同じアクセス権
CREATE POLICY "Team members can view task dependencies"
  ON task_dependencies FOR SELECT
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

CREATE POLICY "Team members can manage task dependencies"
  ON task_dependencies FOR ALL
  USING (
    task_id IN (
      SELECT t.id FROM tasks t
      JOIN projects p ON p.id = t.project_id
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_identifier = current_setting('request.jwt.claims', true)::json->>'sub'
    )
  );

-- Service role bypass (for backend API access)
-- Note: This allows the service role to bypass RLS for backend operations
