-- 更新 anim_videos 表，添加 DashScope API 响应字段
-- 根据 DashScope API 响应格式添加字段

-- 添加时间字段
ALTER TABLE public.anim_videos 
ADD COLUMN IF NOT EXISTS submit_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS scheduled_time TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS end_time TIMESTAMPTZ;

-- 添加提示词字段
ALTER TABLE public.anim_videos 
ADD COLUMN IF NOT EXISTS orig_prompt TEXT,
ADD COLUMN IF NOT EXISTS actual_prompt TEXT;

-- 添加使用情况字段
ALTER TABLE public.anim_videos 
ADD COLUMN IF NOT EXISTS duration INTEGER, -- 视频时长（秒）
ADD COLUMN IF NOT EXISTS video_count INTEGER DEFAULT 1, -- 视频数量
ADD COLUMN IF NOT EXISTS sr INTEGER; -- 采样率/分辨率 (SR)

-- 添加 request_id 字段（DashScope API 返回的请求ID）
ALTER TABLE public.anim_videos 
ADD COLUMN IF NOT EXISTS request_id TEXT;

-- 更新注释
COMMENT ON COLUMN public.anim_videos.submit_time IS 'DashScope API 任务提交时间';
COMMENT ON COLUMN public.anim_videos.scheduled_time IS 'DashScope API 任务计划执行时间';
COMMENT ON COLUMN public.anim_videos.end_time IS 'DashScope API 任务结束时间';
COMMENT ON COLUMN public.anim_videos.orig_prompt IS 'DashScope API 原始提示词';
COMMENT ON COLUMN public.anim_videos.actual_prompt IS 'DashScope API 实际使用的提示词';
COMMENT ON COLUMN public.anim_videos.duration IS '视频时长（秒）';
COMMENT ON COLUMN public.anim_videos.video_count IS '视频数量';
COMMENT ON COLUMN public.anim_videos.sr IS '采样率/分辨率';
COMMENT ON COLUMN public.anim_videos.request_id IS 'DashScope API 请求ID';

