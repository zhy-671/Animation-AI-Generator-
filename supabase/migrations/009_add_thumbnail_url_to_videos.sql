-- 添加 thumbnail_url 字段到 anim_videos 表
ALTER TABLE public.anim_videos 
ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

COMMENT ON COLUMN public.anim_videos.thumbnail_url IS '视频缩略图URL';

