-- Create characters table
-- This table stores character information for each project
CREATE TABLE IF NOT EXISTS anim_characters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES anim_storyboard_projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Basic character information
  name TEXT NOT NULL,
  role TEXT,
  age TEXT,
  gender TEXT,
  description TEXT,
  
  -- Appearance information (stored as JSONB)
  appearance JSONB DEFAULT '{}'::jsonb,
  -- appearance structure:
  -- {
  --   "hair_color": "",
  --   "eye_color": "",
  --   "hair_style": "",
  --   "height": "",
  --   "build": "",
  --   "skin_tone": "",
  --   "facial_features": "",
  --   "distinct_marks": ""
  -- }
  
  -- Clothing information (stored as JSONB)
  clothing_style JSONB DEFAULT '{}'::jsonb,
  -- clothing_style structure:
  -- {
  --   "style": "",
  --   "accessories": "",
  --   "footwear": ""
  -- }
  
  -- Character traits and background
  personality_traits TEXT,
  background TEXT,
  skills_abilities TEXT[] DEFAULT ARRAY[]::TEXT[],
  relationships TEXT[] DEFAULT ARRAY[]::TEXT[],
  visual_reference_prompt TEXT,
  pose_references TEXT[] DEFAULT ARRAY[]::TEXT[],
  
  -- Image and generation related
  image_url TEXT,
  image_generation_prompt TEXT,
  resolution TEXT, -- e.g., "1920*1080", "1024*1024"
  visual_style TEXT, -- e.g., "2d", "3d"
  art_setting TEXT, -- e.g., "16:9", "4:3", "1:1"
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on project_id for faster queries
CREATE INDEX IF NOT EXISTS idx_anim_characters_project_id ON anim_characters(project_id);

-- Create index on user_id for RLS and faster queries
CREATE INDEX IF NOT EXISTS idx_anim_characters_user_id ON anim_characters(user_id);

-- Create index on name for faster searches
CREATE INDEX IF NOT EXISTS idx_anim_characters_name ON anim_characters(name);

-- Enable Row Level Security
ALTER TABLE anim_characters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Policy: Users can only see their own characters
CREATE POLICY "Users can view their own characters"
  ON anim_characters
  FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own characters
CREATE POLICY "Users can insert their own characters"
  ON anim_characters
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own characters
CREATE POLICY "Users can update their own characters"
  ON anim_characters
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own characters
CREATE POLICY "Users can delete their own characters"
  ON anim_characters
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_anim_characters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_anim_characters_updated_at
  BEFORE UPDATE ON anim_characters
  FOR EACH ROW
  EXECUTE FUNCTION update_anim_characters_updated_at();

-- Add comments for documentation
COMMENT ON TABLE anim_characters IS 'Stores character information for storyboard projects';
COMMENT ON COLUMN anim_characters.appearance IS 'JSONB object containing appearance details (hair_color, eye_color, etc.)';
COMMENT ON COLUMN anim_characters.clothing_style IS 'JSONB object containing clothing details (style, accessories, footwear)';
COMMENT ON COLUMN anim_characters.resolution IS 'Image resolution format: width*height (e.g., "1920*1080")';
COMMENT ON COLUMN anim_characters.visual_style IS 'Visual style: "2d", "3d", etc.';
COMMENT ON COLUMN anim_characters.art_setting IS 'Aspect ratio: "16:9", "4:3", "1:1", etc.';

