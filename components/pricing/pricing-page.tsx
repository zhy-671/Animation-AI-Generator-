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
import { subscribeToPlan, purchaseCredits, refreshCreditsBalance } from "@/lib/payment/client";
import { createClient } from "@/lib/supabase/client";

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
  const [loading, setLoading] = useState<string | null>(null); // 存储正在加载的订单ID
  const [error, setError] = useState<string | null>(null);
  const creditsSectionRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createClient();

  // 处理订阅
  const handleSubscribe = async (planName: 'basic' | 'pro' | 'studio') => {
    console.log('handleSubscribe called with planName:', planName);
    try {
      setError(null);
      setLoading(`subscribe-${planName}`);
      console.log('Loading state set to:', `subscribe-${planName}`);
      
      // 检查用户是否登录
      console.log('Checking user authentication...');
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      console.log('User check result:', { user: !!user, error: userError });
      
      if (userError || !user) {
        console.log('User not authenticated, redirecting to login');
        setLoading(null);
        setError('Please login to continue');
        setTimeout(() => {
          router.push('/login?from=' + encodeURIComponent('/pricing'));
        }, 1500);
        return;
      }

      console.log('User authenticated, creating subscription order for plan:', planName);
      
      // 添加超时处理
      const timeoutPromise = new Promise<{ success: false; error: string }>((resolve) => {
        setTimeout(() => {
          console.warn('Request timeout after 30 seconds');
          resolve({ success: false, error: 'Request timeout. Please try again.' });
        }, 30000); // 30秒超时
      });

      console.log('Calling subscribeToPlan...');
      const result = await Promise.race([
        subscribeToPlan(planName),
        timeoutPromise,
      ]);
      
      console.log('Subscription result:', result);
      
      if (!result.success) {
        const errorMessage = result.error || 'Failed to create subscription order';
        console.error('Subscription failed:', errorMessage);
        setError(errorMessage);
        setLoading(null);
      } else if (result.payment_url) {
        // 如果成功且有支付URL，会跳转到支付页面
        console.log('Redirecting to payment URL:', result.payment_url);
        // window.location.href 已经在 subscribeToPlan 中处理了
        // 如果跳转失败，设置一个备用超时
        setTimeout(() => {
          if (document.hasFocus()) {
            // 如果页面还在焦点，说明跳转可能失败了
            console.warn('Page still focused, redirect may have failed');
            setError('Redirect failed. Please check the payment URL manually.');
            setLoading(null);
          }
        }, 2000);
      } else {
        console.error('Payment URL not received in result');
        setError('Payment URL not received from server');
        setLoading(null);
      }
    } catch (err) {
      console.error('Error subscribing:', err);
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      console.error('Setting error message:', errorMessage);
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

      console.log('Creating credit purchase order for package:', packageName);
      
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
      
      console.log('Credit purchase result:', result);
      
      if (!result.success) {
        const errorMessage = result.error || 'Failed to create credit purchase order';
        console.error('Credit purchase failed:', errorMessage);
        setError(errorMessage);
        setLoading(null);
      } else if (result.payment_url) {
        // 如果成功且有支付URL，会跳转到支付页面
        console.log('Redirecting to payment URL:', result.payment_url);
        // window.location.href 已经在 purchaseCredits 中处理了
        // 如果跳转失败，设置一个备用超时
        setTimeout(() => {
          if (document.hasFocus()) {
            // 如果页面还在焦点，说明跳转可能失败了
            console.warn('Page still focused, redirect may have failed');
            setError('Redirect failed. Please check the payment URL manually.');
            setLoading(null);
          }
        }, 2000);
      } else {
        console.error('Payment URL not received in result');
        setError('Payment URL not received from server');
        setLoading(null);
      }
    } catch (err) {
      console.error('Error purchasing credits:', err);
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
      
      if (paymentStatus === 'success') {
        // 支付成功，刷新积分余额
        refreshCreditsBalance();
        // 清除URL参数
        window.history.replaceState({}, '', '/pricing');
      } else if (paymentStatus === 'failed') {
        setError('Payment failed. Please try again.');
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
                            console.log('Subscribe button clicked for plan:', plan.name);
                            const planName = plan.name.toLowerCase() as 'basic' | 'pro' | 'studio';
                            console.log('Calling handleSubscribe with planName:', planName);
                            try {
                              await handleSubscribe(planName);
                            } catch (error) {
                              console.error('Error in onClick handler:', error);
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
                          console.log('Buy Credits button clicked for package:', pkg.name);
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
                  console.log('Closing error message');
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

