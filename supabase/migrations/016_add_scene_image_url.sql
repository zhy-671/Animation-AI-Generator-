-- 添加场景图字段到 anim_scene_items 表
-- 场景图用于在生成分镜图片时作为参考图

ALTER TABLE public.anim_scene_items
  ADD COLUMN IF NOT EXISTS scene_image_url TEXT;

COMMENT ON COLUMN public.anim_scene_items.scene_image_url IS '场景图URL，用于在生成分镜图片时作为参考图';

