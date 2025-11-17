-- 创建支付订单表
CREATE TABLE IF NOT EXISTS public.payment_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.anim_customers(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL CHECK (order_type IN ('subscription', 'credits')),
  plan_name TEXT, -- 订阅计划名称 (basic, pro, studio) 或 null
  credit_package_name TEXT, -- 积分包名称 (Small Pack, Medium Pack, etc.) 或 null
  credits_amount INTEGER, -- 购买的积分数量（仅用于积分购买）
  amount DECIMAL(10, 2) NOT NULL, -- 支付金额（美元）
  currency TEXT NOT NULL DEFAULT 'USD',
  creem_order_id TEXT UNIQUE, -- Cream支付订单ID
  creem_payment_id TEXT, -- Cream支付ID
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded')),
  payment_method TEXT, -- 支付方式
  metadata JSONB DEFAULT '{}'::jsonb, -- 存储额外的支付信息
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ, -- 支付完成时间
  expires_at TIMESTAMPTZ -- 订单过期时间（24小时后）
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_payment_orders_customer_id ON public.payment_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_creem_order_id ON public.payment_orders(creem_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_orders_status ON public.payment_orders(status);
CREATE INDEX IF NOT EXISTS idx_payment_orders_created_at ON public.payment_orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_orders_order_type ON public.payment_orders(order_type);

-- 启用 Row Level Security (RLS)
ALTER TABLE public.payment_orders ENABLE ROW LEVEL SECURITY;

-- 创建 RLS 策略：用户只能查看自己的订单
CREATE POLICY "Users can view own payment orders"
  ON public.payment_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.anim_customers
      WHERE anim_customers.id = payment_orders.customer_id
      AND anim_customers.user_id = auth.uid()
    )
  );

-- 创建 RLS 策略：用户只能创建自己的订单
CREATE POLICY "Users can insert own payment orders"
  ON public.payment_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.anim_customers
      WHERE anim_customers.id = payment_orders.customer_id
      AND anim_customers.user_id = auth.uid()
    )
  );

-- 为 payment_orders 表添加自动更新 updated_at 的触发器
DROP TRIGGER IF EXISTS update_payment_orders_updated_at ON public.payment_orders;
CREATE TRIGGER update_payment_orders_updated_at
  BEFORE UPDATE ON public.payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 创建函数：自动设置订单过期时间（24小时后）
CREATE OR REPLACE FUNCTION public.set_order_expires_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.expires_at IS NULL THEN
    NEW.expires_at = NOW() + INTERVAL '24 hours';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：在创建订单时自动设置过期时间
DROP TRIGGER IF EXISTS set_payment_order_expires_at ON public.payment_orders;
CREATE TRIGGER set_payment_order_expires_at
  BEFORE INSERT ON public.payment_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_order_expires_at();

