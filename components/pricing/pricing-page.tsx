"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Sparkles, Zap, Crown } from "lucide-react";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { subscribeToPlan, purchaseCredits, refreshCreditsBalance, refreshSubscriptionPlan } from "@/lib/payment/client";
import { createClient } from "@/lib/supabase/client";
import { trackCompletePayment } from "@/lib/tiktok-pixel";

const subscriptionPlans = [
  {
    name: "Basic",
    price: "$19.99",
    period: "per month",
    credits: 1500,
    features: [
      "1,500 Credits/month",
      "Text-to-Video Generation",
      "Image-to-Video Generation",
      "480p / 720p Resolution",
      "50 Images/month",
      "20 Storyboards/month",
      "60s Voiceover/month",
      "Individual Video Download",
      "Email Support",
    ],
    limitations: [
      "480p / 720p only",
      "No Commercial License",
      "No Complete Video Export",
    ],
    commercialLicense: false,
    videoResolutions: ["480p", "720p"],
    allowsCompleteVideoExport: false,
    popular: false,
    icon: Sparkles,
  },
  {
    name: "Pro",
    price: "$39.99",
    period: "per month",
    credits: 3500,
    features: [
      "3,500 Credits/month",
      "All Basic Features",
      "480p / 720p / 1080p Resolution",
      "200 Images/month",
      "100 Storyboards/month",
      "300s Voiceover/month",
      "Individual Video Download",
      "Complete Video Export",
      "Commercial Use License",
      "Priority Support",
    ],
    limitations: [],
    commercialLicense: true,
    videoResolutions: ["480p", "720p", "1080p"],
    allowsCompleteVideoExport: true,
    popular: true,
    icon: Zap,
  },
  {
    name: "Studio",
    price: "$129.99",
    period: "per month",
    credits: 10000,
    features: [
      "10,000 Credits/month",
      "All Pro Features",
      "720p / 1080p Resolution",
      "500 Images/month",
      "200 Storyboards/month",
      "900s Voiceover/month",
      "Individual Video Download",
      "Complete Video Export",
      "Commercial License",
      "Video Storage",
      "Premium Customer Support",
    ],
    limitations: [],
    commercialLicense: true,
    videoResolutions: ["720p", "1080p"],
    allowsCompleteVideoExport: true,
    popular: false,
    icon: Crown,
  },
];

const creditPackages = [
  {
    name: "Small Pack",
    credits: 300,
    price: "$4.99",
    pricePerCredit: "$0.017",
    description: "Perfect for trying out our platform",
    badge: "Best for New Users",
  },
  {
    name: "Medium Pack",
    credits: 1000,
    price: "$14.99",
    pricePerCredit: "$0.015",
    description: "Great value, recommended choice",
    badge: "Most Popular",
    popular: true,
  },
  {
    name: "Large Pack",
    credits: 2500,
    price: "$29.99",
    pricePerCredit: "$0.012",
    description: "Best value for money",
    badge: "Best Value",
  },
  {
    name: "Pro Bundle",
    credits: 5000,
    price: "$49.99",
    pricePerCredit: "$0.01",
    description: "For Studio users, highest discount",
    badge: "VIP Discount",
  },
];

export default function PricingPage() {
  const [activeTab, setActiveTab] = useState<"subscription" | "credits">("subscription");
  const [loading, setLoading] = useState<string | null>(null); // Store the ID of the order being loaded
  const [error, setError] = useState<string | null>(null);
  const creditsSectionRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // Handle subscription
  const handleSubscribe = async (planName: 'basic' | 'pro' | 'studio') => {
    try {
      setError(null);
      setLoading(`subscribe-${planName}`);
      // 检查用户是否登录
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setLoading(null);
        setError('Please login to continue');
        setTimeout(() => {
          router.push('/login?from=' + encodeURIComponent('/pricing'));
        }, 1500);
        return;
      }
      // 添加超时处理
      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
        setTimeout(() => {
          resolve({ success: false, error: 'Request timeout. Please try again.' });
        }, 30000); // 30秒超时
      });
      const result = await Promise.race([
        subscribeToPlan(planName),
        timeoutPromise,
      ]);
      if (!result.success) {
        const errorMessage = result.error || 'Failed to create subscription order';
        setError(errorMessage);
        setLoading(null);
      } else if (result.payment_url) {
        // If successful and payment URL exists, redirect to payment page
        // window.location.href is already handled in subscribeToPlan
        // If redirect fails, set a fallback timeout
        setTimeout(() => {
          if (document.hasFocus()) {
            // 如果页面还在焦点，说明跳转可能失败了
            setError('Redirect failed. Please check the payment URL manually.');
            setLoading(null);
          }
        }, 2000);
      } else {
        setError('Payment URL not received from server');
        setLoading(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(null);
    }
  };

  // 处理购买积分
  const handlePurchaseCredits = async (packageName: string) => {
    try {
      setError(null);
      setLoading(`credits-${packageName}`);
      
      // 检查用户是否登录
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        setLoading(null);
        setError('Please login to continue');
        setTimeout(() => {
          router.push('/login?from=' + encodeURIComponent('/pricing'));
        }, 1500);
        return;
      }
      // 添加超时处理
      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
        setTimeout(() => {
          resolve({ success: false, error: 'Request timeout. Please try again.' });
        }, 30000); // 30秒超时
      });

      const result = await Promise.race([
        purchaseCredits(packageName),
        timeoutPromise,
      ]);
      if (!result.success) {
        const errorMessage = result.error || 'Failed to create credit purchase order';
        setError(errorMessage);
        setLoading(null);
      } else if (result.payment_url) {
        // 如果成功且有支付URL，会跳转到支付页面
        // window.location.href 已经在 purchaseCredits 中处理了
        // 如果跳转失败，设置一个备用超时
        setTimeout(() => {
          if (document.hasFocus()) {
            // 如果页面还在焦点，说明跳转可能失败了
            setError('Redirect failed. Please check the payment URL manually.');
            setLoading(null);
          }
        }, 2000);
      } else {
        setError('Payment URL not received from server');
        setLoading(null);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      setLoading(null);
    }
  };

  // 检查URL参数，看是否是从支付页面返回的
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const paymentStatus = params.get('payment_status');
      const orderId = params.get('order_id');
      const checkoutId = params.get('checkout_id');
      const subscriptionId = params.get('subscription_id');
      
      // 如果有订单ID（无论是否有 payment_status），都尝试处理
      // 因为 Creem 可能直接重定向到 pricing 页面，不经过 /payment/success
      if (orderId) {
        // 如果有 checkout_id 或 subscription_id，说明是支付成功返回
        const isPaymentSuccess = paymentStatus === 'success' || checkoutId || subscriptionId;
        
        if (isPaymentSuccess) {
        // 使用 sessionStorage 来防止重复发送事件（即使页面刷新）
        const eventKey = `tt_payment_event_${orderId}`;
        const eventAlreadySent = sessionStorage.getItem(eventKey);
        
        if (eventAlreadySent) {
          // 清除URL参数
          window.history.replaceState({}, '', '/pricing');
          return;
        }
        
        // 获取订单信息并验证支付状态，支持轮询等待订单完成
        const fetchOrderInfo = async (retryCount = 0) => {
          try {
            // 如果有 checkout_id，也传递给 API
            const url = checkoutId 
              ? `/api/payment/order/${orderId}?checkout_id=${encodeURIComponent(checkoutId)}`
              : `/api/payment/order/${orderId}`;
            const response = await fetch(url);
            if (response.ok) {
              const orderData = await response.json();
              
              if (orderData.success && orderData.order) {
                // 订单找到，继续处理
                const order = orderData.order;
                
                // 如果订单状态为 'completed' 或 'processing'，则发送事件
                // 因为如果积分已经增加，说明支付已经成功，即使订单状态还是 'processing'
                if (order.status === 'completed' || order.status === 'processing') {
                  const productType = order.product_type || 'credits';
                  const amount = parseFloat(order.amount || '0');
                  
                  // 发送 CompletePayment 事件
                  const eventSent = trackCompletePayment({
                    content_type: 'product',
                    value: amount,
                    currency: 'USD',
                    content_name: productType === 'subscription' 
                      ? order.plan_name || 'Subscription' 
                      : `${order.credits || 0} Credits`,
                    content_id: orderId,
                  });
                  
                  if (eventSent) {
                    // 标记事件已发送
                    sessionStorage.setItem(eventKey, 'true');
                  }
                  
                  // 如果有 subscription_id，保存到数据库
                  if (subscriptionId) {
                    try {
                      await fetch('/api/subscription/update-subscription-id', {
                        method: 'POST',
                        headers: {
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          subscription_id: subscriptionId,
                        }),
                      });
                    } catch (error) {
                      // 静默处理错误
                    }
                  }
                  
                  // 支付成功，刷新积分余额和订阅计划（不刷新页面，只更新状态）
                  refreshCreditsBalance();
                  
                  // 刷新订阅计划并保存到 Cookie（不刷新页面）
                  const refreshSubscriptionPlanData = async () => {
                    try {
                      const response = await fetch('/api/subscription/plan');
                      if (response.ok) {
                        const data = await response.json();
                        if (data.data?.plan) {
                          // 保存到 Cookie
                          const expires = new Date();
                          expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天
                          document.cookie = `subscription_plan=${data.data.plan}; expires=${expires.toUTCString()}; path=/`;
                        }
                      }
                    } catch (error) {
                      // 静默处理错误
                    }
                  };
                  
                  refreshSubscriptionPlanData();
                  
                  // 触发订阅计划更新事件，通知其他页面刷新
                  refreshSubscriptionPlan();
                  
                  return; // 事件已发送，不再重试
                } 
                // 如果订单状态是 'processing'，继续轮询等待订单完成
                else if (order.status === 'processing' && retryCount < 10) {
                  setTimeout(() => {
                    fetchOrderInfo(retryCount + 1);
                  }, 2000);
                }
                // 如果订单状态不是 'completed' 且不是 'processing'，清除URL参数
                else {
                  window.history.replaceState({}, '', '/pricing');
                }
              } else {
                // 如果获取订单失败，但重试次数未达上限，继续重试
                if (retryCount < 10) {
                  setTimeout(() => {
                    fetchOrderInfo(retryCount + 1);
                  }, 2000);
                } else {
                  // 清除URL参数
                  window.history.replaceState({}, '', '/pricing');
                }
              }
            } else {
              // 如果订单不存在（404），但有 subscription_id，说明是订阅支付成功
              // 可以直接发送事件，不需要等待订单
              if (response.status === 404 && subscriptionId) {
                // 先保存 subscription_id
                try {
                  await fetch('/api/subscription/update-subscription-id', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      subscription_id: subscriptionId,
                    }),
                  });
                } catch (error) {
                  // 静默处理错误
                }
                
                // 获取订阅计划信息
                try {
                  const planResponse = await fetch('/api/subscription/plan');
                  if (planResponse.ok) {
                    const planData = await planResponse.json();
                    if (planData.success && planData.data?.plan) {
                      // 从配置中获取订阅计划的价格
                      const SUBSCRIPTION_PLANS: Record<string, { price: number; credits: number }> = {
                        basic: { price: 19.99, credits: 1500 },
                        pro: { price: 39.99, credits: 3500 },
                        studio: { price: 129.99, credits: 10000 },
                      };
                      
                      const planInfo = SUBSCRIPTION_PLANS[planData.data.plan];
                      if (planInfo) {
                        const eventSent = trackCompletePayment({
                          content_type: 'product',
                          value: planInfo.price,
                          currency: 'USD',
                          content_name: planData.data.plan.charAt(0).toUpperCase() + planData.data.plan.slice(1) + ' Plan',
                          content_id: subscriptionId,
                        });
                        
                        if (eventSent) {
                          sessionStorage.setItem(eventKey, 'true');
                          
                          // 刷新积分余额和订阅计划（不刷新页面，只更新状态）
                          refreshCreditsBalance();
                          
                          // 刷新订阅计划并保存到 Cookie（不刷新页面）
                          const refreshSubscriptionPlanData = async () => {
                            try {
                              const response = await fetch('/api/subscription/plan');
                              if (response.ok) {
                                const data = await response.json();
                                if (data.data?.plan) {
                                  // 保存到 Cookie
                                  const expires = new Date();
                                  expires.setTime(expires.getTime() + 30 * 24 * 60 * 60 * 1000); // 30天
                                  document.cookie = `subscription_plan=${data.data.plan}; expires=${expires.toUTCString()}; path=/`;
                                }
                              }
                            } catch (error) {
                              // 静默处理错误
                            }
                          };
                          
                          refreshSubscriptionPlanData();
                          
                          // 触发订阅计划更新事件，通知其他页面刷新
                          refreshSubscriptionPlan();
                          
                          return; // 事件已发送，不再重试
                        }
                      }
                    }
                  }
                } catch (error) {
                  // 静默处理错误
                }
              }
              
              // 如果获取订单失败，但重试次数未达上限，继续重试
              if (retryCount < 10) {
                setTimeout(() => {
                  fetchOrderInfo(retryCount + 1);
                }, 2000);
              } else {
                // 清除URL参数
                window.history.replaceState({}, '', '/pricing');
              }
            }
          } catch (error) {
            // 如果出错，但重试次数未达上限，继续重试
            if (retryCount < 10) {
              setTimeout(() => {
                fetchOrderInfo(retryCount + 1);
              }, 2000);
            } else {
              // 清除URL参数
              window.history.replaceState({}, '', '/pricing');
            }
          }
        };
        
        fetchOrderInfo();
        }
      } else if (paymentStatus === 'failed') {
        setError('Payment failed. Please try again.');
        // 清除URL参数
        window.history.replaceState({}, '', '/pricing');
      } else if (paymentStatus === 'cancelled') {
        // 清除URL参数
        window.history.replaceState({}, '', '/pricing');
      }
    }
  }, []);

  // 当切换到 credits 标签时，滚动到该区域
  useEffect(() => {
    if (activeTab === "credits" && creditsSectionRef.current) {
      setTimeout(() => {
        creditsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [activeTab]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <section className="container mx-auto px-4 py-16 md:py-24 flex-grow">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Flexible Pricing for Every Creator
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Start generating animations your way — whether you're a storyteller, filmmaker, or studio team.
          </p>
        </motion.div>

        {/* Tabs for Subscription and Credits */}
        <Tabs 
          value={activeTab} 
          onValueChange={(value) => setActiveTab(value as "subscription" | "credits")}
          className="w-full"
        >
          <div className="mb-12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="flex justify-center"
            >
              <TabsList className="grid w-full max-w-md grid-cols-2 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
                <TabsTrigger 
                  value="subscription"
                  className="data-[state=active]:bg-[#FFDA2A] data-[state=active]:text-gray-900 rounded-md transition-all"
                >
                  Subscription
                </TabsTrigger>
                <TabsTrigger 
                  value="credits"
                  className="data-[state=active]:bg-[#FFDA2A] data-[state=active]:text-gray-900 rounded-md transition-all"
                >
                  Credits
                </TabsTrigger>
              </TabsList>
            </motion.div>
          </div>
          <TabsContent value="subscription" className="mt-8">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Subscription Plans
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Get monthly credits to create high-quality animations, storyboards, and video scenes — powered by AI.
              </p>
            </motion.div>

            <div className="flex flex-wrap justify-center gap-6 max-w-6xl mx-auto">
              {subscriptionPlans.map((plan, index) => {
                const Icon = plan.icon;
                return (
                  <motion.div
                    key={plan.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                    className="w-full sm:w-[calc(50%-12px)] lg:w-[calc(33.333%-16px)]"
                  >
                    <Card
                      className={`relative h-full flex flex-col ${
                        plan.popular
                          ? "border-2 border-[#FFDA2A] shadow-lg md:scale-105"
                          : "border-gray-200 dark:border-gray-800"
                      }`}
                    >
                      {plan.popular && (
                        <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                          <span className="bg-[#FFDA2A] text-gray-900 px-4 py-1 rounded-full text-sm font-semibold">
                            Most Popular
                          </span>
                        </div>
                      )}
                      <CardHeader>
                        <div className="flex items-center gap-3 mb-2">
                          <Icon className="w-6 h-6 text-[#FFDA2A]" />
                          <CardTitle className="text-2xl">{plan.name}</CardTitle>
                        </div>
                        <div className="mt-4">
                          <span className="text-4xl font-bold text-gray-900 dark:text-white">
                            {plan.price}
                          </span>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">
                            {plan.period}
                          </span>
                        </div>
                        <CardDescription className="text-base mt-2">
                          {plan.credits.toLocaleString()} Credits/month
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow">
                        <ul className="space-y-3 mb-4">
                          {plan.features.map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <Check className="w-5 h-5 text-[#FFDA2A] flex-shrink-0 mt-0.5" />
                              <span className="text-gray-700 dark:text-gray-300 text-sm">{feature}</span>
                            </li>
                          ))}
                        </ul>
                        {plan.limitations && plan.limitations.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2 uppercase tracking-wide">
                              Limitations
                            </p>
                            <ul className="space-y-2">
                              {plan.limitations.map((limitation, idx) => (
                                <li key={idx} className="flex items-start gap-2">
                                  <span className="text-gray-500 dark:text-gray-400 text-xs">•</span>
                                  <span className="text-gray-500 dark:text-gray-400 text-xs">{limitation}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </CardContent>
                      <CardFooter>
                        <Button
                          className={`w-full ${
                            plan.popular
                              ? "bg-[#FFDA2A] text-gray-900 hover:bg-[#FFDA2A]/90"
                              : ""
                          }`}
                          variant={plan.popular ? "default" : "outline"}
                          onClick={async (e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            const planName = plan.name.toLowerCase() as 'basic' | 'pro' | 'studio';
                            try {
                              await handleSubscribe(planName);
                            } catch (error) {
                              setError(error instanceof Error ? error.message : 'An unexpected error occurred');
                              setLoading(null);
                            }
                          }}
                          disabled={loading === `subscribe-${plan.name.toLowerCase()}`}
                        >
                          {loading === `subscribe-${plan.name.toLowerCase()}` ? 'Processing...' : 'Get Started'}
                        </Button>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </TabsContent>

          {/* Credit Packages */}
          <TabsContent value="credits" className="mt-8">
            <div ref={creditsSectionRef}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              className="text-center mb-12"
            >
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Pay-as-you-go Credits
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Not ready for a subscription? Purchase credits and use them anytime to generate images, storyboards, or short AI videos.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
              {creditPackages.map((pkg, index) => (
                <motion.div
                  key={pkg.name}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.3 + index * 0.1 }}
                >
                  <Card
                    className={`relative h-full flex flex-col ${
                      pkg.popular
                        ? "border-2 border-[#FFDA2A] shadow-lg"
                        : "border-gray-200 dark:border-gray-800"
                    }`}
                  >
                    {pkg.badge && (
                      <div className="absolute -top-3 right-4">
                        <span className="bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-3 py-1 rounded-full text-xs font-semibold">
                          {pkg.badge}
                        </span>
                      </div>
                    )}
                    <CardHeader>
                      <CardTitle className="text-xl">{pkg.name}</CardTitle>
                      <div className="mt-4">
                        <div className="text-3xl font-bold text-gray-900 dark:text-white">
                          {pkg.price}
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {pkg.pricePerCredit} per credit
                        </div>
                      </div>
                      <CardDescription className="text-lg font-semibold mt-2">
                        {pkg.credits.toLocaleString()} Credits
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex-grow">
                      <p className="text-gray-600 dark:text-gray-400">{pkg.description}</p>
                    </CardContent>
                    <CardFooter>
                      <Button
                        className={`w-full ${
                          pkg.popular
                            ? "bg-[#FFDA2A] text-gray-900 hover:bg-[#FFDA2A]/90"
                            : ""
                        }`}
                        variant={pkg.popular ? "default" : "outline"}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handlePurchaseCredits(pkg.name);
                        }}
                        disabled={loading === `credits-${pkg.name}`}
                      >
                        {loading === `credits-${pkg.name}` ? 'Processing...' : 'Buy Credits'}
                      </Button>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[99999] bg-red-500 text-white px-6 py-3 rounded-lg shadow-2xl max-w-md border-2 border-red-600"
            role="alert"
          >
            <div className="flex items-center justify-between gap-4">
              <span className="font-medium text-sm">{error}</span>
              <button
                onClick={() => {
                  setError(null);
                }}
                className="text-white hover:text-gray-200 transition-colors flex-shrink-0 text-lg font-bold leading-none"
                aria-label="Close error message"
              >
                ✕
              </button>
            </div>
          </motion.div>
        )}

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-16"
        >
          <h3 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-4">
            Ready to Start Creating?
          </h3>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            Choose the plan that works best for you, or start with credits to test the waters.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" className="bg-[#FFDA2A] text-gray-900 hover:bg-[#FFDA2A]/90" asChild>
              <Link href="/generate">
                Get Started
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline"
              onClick={() => setActiveTab("credits")}
            >
              Buy Credits
            </Button>
          </div>
        </motion.div>
      </section>
      <Footer />
    </div>
  );
}

