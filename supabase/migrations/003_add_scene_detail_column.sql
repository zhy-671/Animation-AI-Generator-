-- 为 anim_scene_items 表添加 scene_detail 字段（如果不存在）
-- 用于存储画面描述，供视频生成使用

-- 检查并添加 scene_detail 字段
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'anim_scene_items' 
    AND column_name = 'scene_detail'
  ) THEN
    ALTER TABLE public.anim_scene_items 
    ADD COLUMN scene_detail TEXT;
    
    RAISE NOTICE 'Added scene_detail column to anim_scene_items table';
  ELSE
    RAISE NOTICE 'scene_detail column already exists in anim_scene_items table';
  END IF;
END $$;

