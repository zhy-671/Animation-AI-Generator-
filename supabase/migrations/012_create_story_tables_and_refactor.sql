-- 重构数据库结构：创建多表关联
-- 1. 故事剧本表
-- 2. 角色信息故事大纲表
-- 3. 修改场次表添加项目关联

-- ============================================
-- 0. 修改项目主表，将 content 列改为可空（因为现在存储在 anim_story_scripts 表中）
-- ============================================
ALTER TABLE public.anim_storyboard_projects
  ALTER COLUMN content DROP NOT NULL;

-- ============================================
-- 1. 创建故事剧本表 (anim_story_scripts)
-- ============================================
CREATE TABLE IF NOT EXISTS public.anim_story_scripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.anim_storyboard_projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL, -- 完整的故事文本内容
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_project_script UNIQUE(project_id) -- 每个项目只有一个故事剧本
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anim_story_scripts_project_id ON public.anim_story_scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_anim_story_scripts_created_at ON public.anim_story_scripts(created_at DESC);

-- 创建更新时间触发器（先删除如果存在）
DROP TRIGGER IF EXISTS update_anim_story_scripts_updated_at ON public.anim_story_scripts;
CREATE TRIGGER update_anim_story_scripts_updated_at
  BEFORE UPDATE ON public.anim_story_scripts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用 RLS
ALTER TABLE public.anim_story_scripts ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own story scripts" ON public.anim_story_scripts;
DROP POLICY IF EXISTS "Users can insert their own story scripts" ON public.anim_story_scripts;
DROP POLICY IF EXISTS "Users can update their own story scripts" ON public.anim_story_scripts;
DROP POLICY IF EXISTS "Users can delete their own story scripts" ON public.anim_story_scripts;

-- RLS 策略：用户只能访问自己项目的故事剧本
CREATE POLICY "Users can view their own story scripts"
  ON public.anim_story_scripts FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_storyboard_projects
      WHERE anim_storyboard_projects.id = anim_story_scripts.project_id
      AND anim_storyboard_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own story scripts"
  ON public.anim_story_scripts FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anim_storyboard_projects
      WHERE anim_storyboard_projects.id = anim_story_scripts.project_id
      AND anim_storyboard_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own story scripts"
  ON public.anim_story_scripts FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_storyboard_projects
      WHERE anim_storyboard_projects.id = anim_story_scripts.project_id
      AND anim_storyboard_projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anim_storyboard_projects
      WHERE anim_storyboard_projects.id = anim_story_scripts.project_id
      AND anim_storyboard_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own story scripts"
  ON public.anim_story_scripts FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_storyboard_projects
      WHERE anim_storyboard_projects.id = anim_story_scripts.project_id
      AND anim_storyboard_projects.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.anim_story_scripts IS '故事剧本表，存储完整的原始故事文本';
COMMENT ON COLUMN public.anim_story_scripts.project_id IS '关联的项目ID';
COMMENT ON COLUMN public.anim_story_scripts.content IS '完整的故事文本内容';

-- ============================================
-- 2. 创建角色信息故事大纲表 (anim_story_outlines)
-- ============================================
CREATE TABLE IF NOT EXISTS public.anim_story_outlines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.anim_storyboard_projects(id) ON DELETE CASCADE,
  story_outline JSONB NOT NULL, -- 包含 theme, summary, chapters 等
  characters JSONB NOT NULL, -- 角色信息数组
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_project_outline UNIQUE(project_id) -- 每个项目只有一个故事大纲
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anim_story_outlines_project_id ON public.anim_story_outlines(project_id);
CREATE INDEX IF NOT EXISTS idx_anim_story_outlines_created_at ON public.anim_story_outlines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anim_story_outlines_story_outline ON public.anim_story_outlines USING GIN (story_outline);
CREATE INDEX IF NOT EXISTS idx_anim_story_outlines_characters ON public.anim_story_outlines USING GIN (characters);

-- 创建更新时间触发器（先删除如果存在）
DROP TRIGGER IF EXISTS update_anim_story_outlines_updated_at ON public.anim_story_outlines;
CREATE TRIGGER update_anim_story_outlines_updated_at
  BEFORE UPDATE ON public.anim_story_outlines
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 启用 RLS
ALTER TABLE public.anim_story_outlines ENABLE ROW LEVEL SECURITY;

-- 删除已存在的策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own story outlines" ON public.anim_story_outlines;
DROP POLICY IF EXISTS "Users can insert their own story outlines" ON public.anim_story_outlines;
DROP POLICY IF EXISTS "Users can update their own story outlines" ON public.anim_story_outlines;
DROP POLICY IF EXISTS "Users can delete their own story outlines" ON public.anim_story_outlines;

-- RLS 策略：用户只能访问自己项目的故事大纲
CREATE POLICY "Users can view their own story outlines"
  ON public.anim_story_outlines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_storyboard_projects
      WHERE anim_storyboard_projects.id = anim_story_outlines.project_id
      AND anim_storyboard_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own story outlines"
  ON public.anim_story_outlines FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anim_storyboard_projects
      WHERE anim_storyboard_projects.id = anim_story_outlines.project_id
      AND anim_storyboard_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own story outlines"
  ON public.anim_story_outlines FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_storyboard_projects
      WHERE anim_storyboard_projects.id = anim_story_outlines.project_id
      AND anim_storyboard_projects.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anim_storyboard_projects
      WHERE anim_storyboard_projects.id = anim_story_outlines.project_id
      AND anim_storyboard_projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own story outlines"
  ON public.anim_story_outlines FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_storyboard_projects
      WHERE anim_storyboard_projects.id = anim_story_outlines.project_id
      AND anim_storyboard_projects.user_id = auth.uid()
    )
  );

COMMENT ON TABLE public.anim_story_outlines IS '角色信息故事大纲表，存储故事大纲和角色信息';
COMMENT ON COLUMN public.anim_story_outlines.project_id IS '关联的项目ID';
COMMENT ON COLUMN public.anim_story_outlines.story_outline IS '故事大纲（JSON格式，包含theme, summary, chapters等）';
COMMENT ON COLUMN public.anim_story_outlines.characters IS '角色信息数组（JSON格式）';

-- ============================================
-- 3. 修改场次表 (anim_scenes)，添加项目关联
-- ============================================
-- 添加 project_id 列（如果不存在）
ALTER TABLE public.anim_scenes
  ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES public.anim_storyboard_projects(id) ON DELETE CASCADE;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anim_scenes_project_id ON public.anim_scenes(project_id);

-- 更新 RLS 策略，确保用户只能访问自己项目的场次
-- 删除旧的策略（如果存在）
DROP POLICY IF EXISTS "Users can view their own scenes" ON public.anim_scenes;
DROP POLICY IF EXISTS "Users can insert their own scenes" ON public.anim_scenes;
DROP POLICY IF EXISTS "Users can update their own scenes" ON public.anim_scenes;
DROP POLICY IF EXISTS "Users can delete their own scenes" ON public.anim_scenes;

-- 重新创建策略，同时检查 user_id 和 project_id
CREATE POLICY "Users can view their own scenes"
  ON public.anim_scenes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenes"
  ON public.anim_scenes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.anim_storyboard_projects
        WHERE anim_storyboard_projects.id = anim_scenes.project_id
        AND anim_storyboard_projects.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can update their own scenes"
  ON public.anim_scenes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      project_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.anim_storyboard_projects
        WHERE anim_storyboard_projects.id = anim_scenes.project_id
        AND anim_storyboard_projects.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own scenes"
  ON public.anim_scenes FOR DELETE
  USING (auth.uid() = user_id);

COMMENT ON COLUMN public.anim_scenes.project_id IS '关联的项目ID（可选，用于关联到项目）';

-- ============================================
-- 4. 数据迁移（可选）：将现有数据迁移到新表
-- ============================================
-- 注意：这个迁移脚本假设现有数据已经在 anim_storyboard_projects 表中
-- 如果需要迁移现有数据，可以运行以下 SQL（需要根据实际情况调整）

-- 迁移故事剧本：从 anim_storyboard_projects.content 迁移到 anim_story_scripts
-- INSERT INTO public.anim_story_scripts (project_id, title, content, created_at, updated_at)
-- SELECT 
--   id as project_id,
--   title,
--   content,
--   created_at,
--   updated_at
-- FROM public.anim_storyboard_projects
-- WHERE content IS NOT NULL AND content != ''
-- ON CONFLICT (project_id) DO NOTHING;

-- 迁移故事大纲：从 anim_storyboard_projects.story_outline 迁移到 anim_story_outlines
-- INSERT INTO public.anim_story_outlines (project_id, story_outline, characters, created_at, updated_at)
-- SELECT 
--   id as project_id,
--   story_outline,
--   COALESCE((story_outline->>'characters')::jsonb, '[]'::jsonb) as characters,
--   created_at,
--   updated_at
-- FROM public.anim_storyboard_projects
-- WHERE story_outline IS NOT NULL
-- ON CONFLICT (project_id) DO NOTHING;

-- 更新场次表的 project_id：从 metadata.project_id 迁移到 project_id 列
-- UPDATE public.anim_scenes
-- SET project_id = (metadata->>'project_id')::uuid
-- WHERE metadata->>'project_id' IS NOT NULL
-- AND project_id IS NULL;

