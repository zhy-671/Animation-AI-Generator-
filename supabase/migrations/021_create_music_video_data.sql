-- 创建音乐视频数据表
-- 存储音乐视频的完整数据，包括分段、分镜、场景数据
CREATE TABLE IF NOT EXISTS public.music_video_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  music_id UUID NOT NULL REFERENCES public.anim_music(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- 音频分段数据
  audio_segments JSONB DEFAULT '[]'::jsonb, -- 存储 autoSegments 数组
  
  -- 分镜数据
  storyboard JSONB DEFAULT '{}'::jsonb, -- 存储完整的 storyboard 对象
  
  -- 场景数据（用户编辑的场景信息）
  scene_data JSONB DEFAULT '{}'::jsonb, -- 存储场景图片、描述等
  
  -- 分镜数据（用户编辑的分镜信息）
  shot_data JSONB DEFAULT '{}'::jsonb, -- 存储分镜图片、描述等
  
  -- 其他配置
  visual_style TEXT,
  orientation TEXT DEFAULT '16:9', -- '16:9' or '9:16'
  character_image_url TEXT, -- 角色图片URL
  
  -- 时间戳
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_music_video_data_music_id ON public.music_video_data(music_id);
CREATE INDEX IF NOT EXISTS idx_music_video_data_user_id ON public.music_video_data(user_id);
CREATE INDEX IF NOT EXISTS idx_music_video_data_created_at ON public.music_video_data(created_at DESC);

-- 确保每个音乐只有一个视频数据记录（可选，如果需要唯一性）
CREATE UNIQUE INDEX IF NOT EXISTS unique_music_video_data_music_id ON public.music_video_data(music_id);

-- 启用 Row Level Security (RLS)
ALTER TABLE public.music_video_data ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据
CREATE POLICY "Users can view their own music video data"
  ON public.music_video_data FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own music video data"
  ON public.music_video_data FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own music video data"
  ON public.music_video_data FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own music video data"
  ON public.music_video_data FOR DELETE
  USING (auth.uid() = user_id);

-- 创建更新时间触发器
CREATE TRIGGER update_music_video_data_updated_at
  BEFORE UPDATE ON public.music_video_data
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

