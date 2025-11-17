-- 添加支付订单表的唯一约束和检查约束，增强安全性
-- 防止重复订单和无效数据

-- 确保creem_order_id唯一（如果已存在）
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'payment_orders_creem_order_id_key'
  ) THEN
    ALTER TABLE public.payment_orders 
    ADD CONSTRAINT payment_orders_creem_order_id_key UNIQUE (creem_order_id);
  END IF;
END $$;

-- 添加检查约束：确保积分数量为正数
ALTER TABLE public.payment_orders 
DROP CONSTRAINT IF EXISTS payment_orders_credits_amount_check;

ALTER TABLE public.payment_orders 
ADD CONSTRAINT payment_orders_credits_amount_check 
CHECK (credits_amount IS NULL OR credits_amount > 0);

-- 添加检查约束：确保金额为正数
ALTER TABLE public.payment_orders 
DROP CONSTRAINT IF EXISTS payment_orders_amount_check;

ALTER TABLE public.payment_orders 
ADD CONSTRAINT payment_orders_amount_check 
CHECK (amount > 0);

-- 创建索引：用于快速查找已完成的订单（防止重复处理）
CREATE INDEX IF NOT EXISTS idx_payment_orders_status_completed 
ON public.payment_orders(status, completed_at) 
WHERE status = 'completed';

-- 创建索引：用于快速查找特定订单的积分历史（防止重复添加）
-- 对整个metadata字段创建GIN索引，支持JSONB查询
CREATE INDEX IF NOT EXISTS idx_credits_history_metadata_gin 
ON public.anim_credits_history USING GIN (metadata)
WHERE type = 'add';

-- 创建表达式索引：用于快速查找特定订单ID的积分历史
CREATE INDEX IF NOT EXISTS idx_credits_history_order_id 
ON public.anim_credits_history ((metadata->>'order_id'))
WHERE type = 'add' AND metadata->>'order_id' IS NOT NULL;

-- 添加函数：检查订单是否已经处理过积分
CREATE OR REPLACE FUNCTION public.check_order_credits_processed(order_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
  order_record RECORD;
  history_count INTEGER;
BEGIN
  -- 获取订单信息
  SELECT * INTO order_record
  FROM public.payment_orders
  WHERE id = order_uuid;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- 检查是否已经有对应的积分历史记录
  SELECT COUNT(*) INTO history_count
  FROM public.anim_credits_history
  WHERE customer_id = order_record.customer_id
    AND type = 'add'
    AND amount = order_record.credits_amount
    AND metadata->>'order_id' = order_uuid::text;
  
  RETURN history_count > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 添加注释说明安全措施
COMMENT ON TABLE public.payment_orders IS 
'Payment orders table. Credits can only be added through verified webhook callbacks. Direct API calls to add credits are blocked.';

COMMENT ON COLUMN public.payment_orders.creem_order_id IS 
'Unique Cream order ID. Used to verify webhook authenticity.';

COMMENT ON COLUMN public.payment_orders.status IS 
'Order status: pending, processing, completed, failed, cancelled, refunded. Only completed orders can add credits.';

COMMENT ON FUNCTION public.check_order_credits_processed IS 
'Check if credits for an order have already been processed. Used to prevent duplicate credit additions.';

