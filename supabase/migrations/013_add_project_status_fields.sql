-- 添加项目步骤状态字段
-- 用于跟踪每个步骤的完成状态：故事剧本、设置、分镜、制作视频

ALTER TABLE public.anim_storyboard_projects
  ADD COLUMN IF NOT EXISTS status_script BOOLEAN DEFAULT FALSE, -- 故事剧本是否完成
  ADD COLUMN IF NOT EXISTS status_settings BOOLEAN DEFAULT FALSE, -- 设置是否完成
  ADD COLUMN IF NOT EXISTS status_storyboard BOOLEAN DEFAULT FALSE, -- 分镜是否完成
  ADD COLUMN IF NOT EXISTS status_video BOOLEAN DEFAULT FALSE; -- 制作视频是否完成

COMMENT ON COLUMN public.anim_storyboard_projects.status_script IS '故事剧本步骤完成状态';
COMMENT ON COLUMN public.anim_storyboard_projects.status_settings IS '设置步骤完成状态';
COMMENT ON COLUMN public.anim_storyboard_projects.status_storyboard IS '分镜步骤完成状态';
COMMENT ON COLUMN public.anim_storyboard_projects.status_video IS '制作视频步骤完成状态';

-- 创建索引以优化状态查询
CREATE INDEX IF NOT EXISTS idx_anim_storyboard_projects_status_script ON public.anim_storyboard_projects(status_script);
CREATE INDEX IF NOT EXISTS idx_anim_storyboard_projects_status_settings ON public.anim_storyboard_projects(status_settings);
CREATE INDEX IF NOT EXISTS idx_anim_storyboard_projects_status_storyboard ON public.anim_storyboard_projects(status_storyboard);
CREATE INDEX IF NOT EXISTS idx_anim_storyboard_projects_status_video ON public.anim_storyboard_projects(status_video);

