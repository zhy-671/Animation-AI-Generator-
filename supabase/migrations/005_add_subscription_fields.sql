-- 添加订阅计划相关字段到 anim_customers 表
ALTER TABLE public.anim_customers 
ADD COLUMN IF NOT EXISTS subscription_plan TEXT CHECK (subscription_plan IN ('basic', 'pro', 'studio')),
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_anim_customers_subscription_plan ON public.anim_customers(subscription_plan);
CREATE INDEX IF NOT EXISTS idx_anim_customers_subscription_expires_at ON public.anim_customers(subscription_expires_at);

