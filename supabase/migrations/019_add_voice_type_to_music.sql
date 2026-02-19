-- Add voice_type column to anim_music table
-- voice_type: 'male' (男声), 'female' (女声), 'duet' (男女对唱)
ALTER TABLE public.anim_music 
ADD COLUMN IF NOT EXISTS voice_type TEXT DEFAULT 'female' CHECK (voice_type IN ('male', 'female', 'duet'));

-- Create index for voice_type
CREATE INDEX IF NOT EXISTS idx_anim_music_voice_type ON public.anim_music(voice_type);

