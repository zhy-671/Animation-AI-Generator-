-- 创建故事剧本项目表
CREATE TABLE IF NOT EXISTS public.anim_storyboard_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 添加新列（如果不存在）
ALTER TABLE public.anim_storyboard_projects
  ADD COLUMN IF NOT EXISTS art_setting TEXT DEFAULT '16:9',
  ADD COLUMN IF NOT EXISTS visual_style TEXT DEFAULT '2d',
  ADD COLUMN IF NOT EXISTS character_design TEXT;

-- 添加索引
CREATE INDEX IF NOT EXISTS idx_anim_storyboard_projects_user_id ON public.anim_storyboard_projects(user_id);
CREATE INDEX IF NOT EXISTS idx_anim_storyboard_projects_created_at ON public.anim_storyboard_projects(created_at DESC);

-- 添加更新时间触发器（函数可能已存在，使用 CREATE OR REPLACE）
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 删除触发器（如果存在）然后重新创建
DROP TRIGGER IF EXISTS update_anim_storyboard_projects_updated_at ON public.anim_storyboard_projects;

CREATE TRIGGER update_anim_storyboard_projects_updated_at
  BEFORE UPDATE ON public.anim_storyboard_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用 RLS
ALTER TABLE public.anim_storyboard_projects ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own projects" ON public.anim_storyboard_projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.anim_storyboard_projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.anim_storyboard_projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.anim_storyboard_projects;

-- RLS 策略：用户可以查看自己的项目
CREATE POLICY "Users can view their own projects"
  ON public.anim_storyboard_projects
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 策略：用户可以创建自己的项目
CREATE POLICY "Users can create their own projects"
  ON public.anim_storyboard_projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户可以更新自己的项目
CREATE POLICY "Users can update their own projects"
  ON public.anim_storyboard_projects
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS 策略：用户可以删除自己的项目
CREATE POLICY "Users can delete their own projects"
  ON public.anim_storyboard_projects
  FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.anim_storyboard_projects IS '故事剧本项目表';
COMMENT ON COLUMN public.anim_storyboard_projects.id IS '项目ID';
COMMENT ON COLUMN public.anim_storyboard_projects.user_id IS '用户ID';
COMMENT ON COLUMN public.anim_storyboard_projects.title IS '项目标题';
COMMENT ON COLUMN public.anim_storyboard_projects.content IS '项目内容（纯文本/故事大纲）';
COMMENT ON COLUMN public.anim_storyboard_projects.art_setting IS '美术设定（画面比例，如16:9、9:16等）';
COMMENT ON COLUMN public.anim_storyboard_projects.visual_style IS '画面风格（如2d、3d、anime等）';
COMMENT ON COLUMN public.anim_storyboard_projects.character_design IS '角色设计描述';
COMMENT ON COLUMN public.anim_storyboard_projects.created_at IS '创建时间';
COMMENT ON COLUMN public.anim_storyboard_projects.updated_at IS '更新时间';

