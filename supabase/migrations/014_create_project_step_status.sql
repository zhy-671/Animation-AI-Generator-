-- 创建项目步骤完成状态表
-- 用于独立管理每个项目的各个步骤完成状态
CREATE TABLE IF NOT EXISTS public.anim_project_step_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.anim_storyboard_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 各步骤完成状态
  step_script BOOLEAN DEFAULT FALSE, -- 故事剧本步骤是否完成
  step_settings BOOLEAN DEFAULT FALSE, -- 设置步骤是否完成
  step_storyboard BOOLEAN DEFAULT FALSE, -- 分镜步骤是否完成
  step_video BOOLEAN DEFAULT FALSE, -- 制作视频步骤是否完成
  
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- 确保每个项目只有一条状态记录
  CONSTRAINT unique_project_step_status UNIQUE(project_id, user_id)
);

-- 创建索引以优化查询
CREATE INDEX IF NOT EXISTS idx_anim_project_step_status_project_id ON public.anim_project_step_status(project_id);
CREATE INDEX IF NOT EXISTS idx_anim_project_step_status_user_id ON public.anim_project_step_status(user_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_anim_project_step_status_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_anim_project_step_status_updated_at ON public.anim_project_step_status;
CREATE TRIGGER update_anim_project_step_status_updated_at
  BEFORE UPDATE ON public.anim_project_step_status
  FOR EACH ROW
  EXECUTE FUNCTION update_anim_project_step_status_updated_at();

-- 启用 RLS
ALTER TABLE public.anim_project_step_status ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户可以查看自己的项目状态
CREATE POLICY "Users can view their own project step status"
  ON public.anim_project_step_status
  FOR SELECT
  USING (auth.uid() = user_id);

-- RLS 策略：用户可以插入自己的项目状态
CREATE POLICY "Users can insert their own project step status"
  ON public.anim_project_step_status
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户可以更新自己的项目状态
CREATE POLICY "Users can update their own project step status"
  ON public.anim_project_step_status
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS 策略：用户可以删除自己的项目状态
CREATE POLICY "Users can delete their own project step status"
  ON public.anim_project_step_status
  FOR DELETE
  USING (auth.uid() = user_id);

-- 添加注释
COMMENT ON TABLE public.anim_project_step_status IS '存储项目各个步骤的完成状态';
COMMENT ON COLUMN public.anim_project_step_status.step_script IS '故事剧本步骤完成状态';
COMMENT ON COLUMN public.anim_project_step_status.step_settings IS '设置步骤完成状态';
COMMENT ON COLUMN public.anim_project_step_status.step_storyboard IS '分镜步骤完成状态';
COMMENT ON COLUMN public.anim_project_step_status.step_video IS '制作视频步骤完成状态';

