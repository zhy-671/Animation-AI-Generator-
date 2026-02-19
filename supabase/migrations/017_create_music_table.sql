-- 创建音乐表
CREATE TABLE IF NOT EXISTS public.anim_music (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  prompt TEXT NOT NULL,
  genre TEXT,
  mood TEXT,
  theme TEXT,
  tempo TEXT,
  energy TEXT,
  lyrics BOOLEAN DEFAULT false,
  instrumental BOOLEAN DEFAULT false,
  audio_url TEXT,
  cover_url TEXT,
  duration INTEGER, -- 时长（秒）
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  task_id TEXT, -- 任务ID（如果有）
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anim_music_user_id ON public.anim_music(user_id);
CREATE INDEX IF NOT EXISTS idx_anim_music_created_at ON public.anim_music(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anim_music_status ON public.anim_music(status);

-- 启用 Row Level Security (RLS)
ALTER TABLE public.anim_music ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据
CREATE POLICY "Users can view their own music"
  ON public.anim_music FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own music"
  ON public.anim_music FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own music"
  ON public.anim_music FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own music"
  ON public.anim_music FOR DELETE
  USING (auth.uid() = user_id);

-- 创建更新时间触发器
CREATE TRIGGER update_anim_music_updated_at
  BEFORE UPDATE ON public.anim_music
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

