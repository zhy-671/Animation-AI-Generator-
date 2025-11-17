-- 创建分镜表
CREATE TABLE IF NOT EXISTS public.anim_scenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  cover_image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 创建分镜详情表（存储每个分镜的具体内容）
CREATE TABLE IF NOT EXISTS public.anim_scene_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id UUID NOT NULL REFERENCES public.anim_scenes(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  text TEXT NOT NULL,
  scene_detail TEXT, -- 画面描述（用于视频生成）
  image_url TEXT,
  video_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  CONSTRAINT unique_scene_item UNIQUE(scene_id, scene_number)
);

-- 创建视频表
CREATE TABLE IF NOT EXISTS public.anim_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scene_item_id UUID REFERENCES public.anim_scene_items(id) ON DELETE SET NULL,
  video_url TEXT NOT NULL,
  prompt TEXT,
  image_url TEXT,
  resolution TEXT DEFAULT '1080P',
  task_id TEXT, -- DashScope 任务ID
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anim_scenes_user_id ON public.anim_scenes(user_id);
CREATE INDEX IF NOT EXISTS idx_anim_scenes_created_at ON public.anim_scenes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_anim_scene_items_scene_id ON public.anim_scene_items(scene_id);
CREATE INDEX IF NOT EXISTS idx_anim_videos_user_id ON public.anim_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_anim_videos_scene_item_id ON public.anim_videos(scene_item_id);
CREATE INDEX IF NOT EXISTS idx_anim_videos_status ON public.anim_videos(status);

-- 启用 Row Level Security (RLS)
ALTER TABLE public.anim_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anim_scene_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.anim_videos ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据
CREATE POLICY "Users can view their own scenes"
  ON public.anim_scenes FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own scenes"
  ON public.anim_scenes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own scenes"
  ON public.anim_scenes FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own scenes"
  ON public.anim_scenes FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their own scene items"
  ON public.anim_scene_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_scenes
      WHERE anim_scenes.id = anim_scene_items.scene_id
      AND anim_scenes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert their own scene items"
  ON public.anim_scene_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anim_scenes
      WHERE anim_scenes.id = anim_scene_items.scene_id
      AND anim_scenes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own scene items"
  ON public.anim_scene_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_scenes
      WHERE anim_scenes.id = anim_scene_items.scene_id
      AND anim_scenes.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anim_scenes
      WHERE anim_scenes.id = anim_scene_items.scene_id
      AND anim_scenes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete their own scene items"
  ON public.anim_scene_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_scenes
      WHERE anim_scenes.id = anim_scene_items.scene_id
      AND anim_scenes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view their own videos"
  ON public.anim_videos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own videos"
  ON public.anim_videos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own videos"
  ON public.anim_videos FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own videos"
  ON public.anim_videos FOR DELETE
  USING (auth.uid() = user_id);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_anim_scenes_updated_at
  BEFORE UPDATE ON public.anim_scenes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_anim_scene_items_updated_at
  BEFORE UPDATE ON public.anim_scene_items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_anim_videos_updated_at
  BEFORE UPDATE ON public.anim_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

