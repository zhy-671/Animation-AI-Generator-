-- Create music_video_characters table
-- This table stores character information for music videos
CREATE TABLE IF NOT EXISTS public.music_video_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  music_id UUID NOT NULL REFERENCES public.anim_music(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic character information
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  
  -- Full character data stored as JSONB (similar to anim_characters structure)
  character_data JSONB DEFAULT '{}'::jsonb,
  
  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_music_video_characters_music_id ON public.music_video_characters(music_id);
CREATE INDEX IF NOT EXISTS idx_music_video_characters_user_id ON public.music_video_characters(user_id);
CREATE INDEX IF NOT EXISTS idx_music_video_characters_created_at ON public.music_video_characters(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE public.music_video_characters ENABLE ROW LEVEL SECURITY;

-- RLS 策略：用户只能访问自己的数据
CREATE POLICY "Users can view their own music video characters"
  ON public.music_video_characters FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own music video characters"
  ON public.music_video_characters FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own music video characters"
  ON public.music_video_characters FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own music video characters"
  ON public.music_video_characters FOR DELETE
  USING (auth.uid() = user_id);

-- Create update trigger
CREATE TRIGGER update_music_video_characters_updated_at
  BEFORE UPDATE ON public.music_video_characters
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

