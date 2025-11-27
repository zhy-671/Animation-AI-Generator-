-- 添加 subscription_id 字段到 anim_customers 表
ALTER TABLE public.anim_customers 
ADD COLUMN IF NOT EXISTS subscription_id TEXT;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anim_customers_subscription_id ON public.anim_customers(subscription_id);

