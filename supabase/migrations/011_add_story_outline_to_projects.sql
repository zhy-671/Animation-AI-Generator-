-- 添加故事大纲字段（JSONB类型，存储完整的故事大纲和角色信息）
ALTER TABLE public.anim_storyboard_projects
  ADD COLUMN IF NOT EXISTS story_outline JSONB;

COMMENT ON COLUMN public.anim_storyboard_projects.story_outline IS '故事大纲和角色信息（JSON格式，包含story和characters）';

-- 创建索引以优化JSONB查询
CREATE INDEX IF NOT EXISTS idx_anim_storyboard_projects_story_outline ON public.anim_storyboard_projects USING GIN (story_outline);

