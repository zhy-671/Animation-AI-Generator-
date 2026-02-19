"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Logo from "@/components/logo";
import { Button } from "@/components/ui/button";
import { LogIn, LogOut, Diamond, Menu, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { checkCreditsBalance } from "@/lib/credits/deduct";

export default function Header() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [creditsBalance, setCreditsBalance] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Create Supabase client once and reuse it
  const supabase = createClient();

  useEffect(() => {
    let mounted = true;
    let lastRefreshTime = 0;
    const MIN_REFRESH_INTERVAL = 2000; // 最小刷新间隔 2 秒，防止短时间内重复调用

    // Function to refresh credits balance with throttling
    const refreshCredits = async (retryCount = 0, force = false) => {
      // 节流：如果距离上次刷新不到 2 秒，且不是强制刷新，则直接忽略本次调用
      const now = Date.now();
      if (!force && now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        // 直接忽略，不执行查询
        return;
      }

      lastRefreshTime = now;

      try {
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          // Retry once if it's a network error
          if (retryCount < 1 && userError.message?.includes('fetch')) {
            setTimeout(() => refreshCredits(retryCount + 1, true), 1000);
          }
          return;
        }
        if (currentUser && mounted) {
          try {
            const balanceCheck = await checkCreditsBalance(0);
            if (balanceCheck.balance !== undefined && mounted) {
              setCreditsBalance(balanceCheck.balance);
            } else if (balanceCheck.error && mounted) {
              // Retry once if it's a network error
              if (retryCount < 1 && balanceCheck.error.includes('fetch')) {
                setTimeout(() => refreshCredits(retryCount + 1, true), 1000);
              }
            }
          } catch (error) {
            // Retry once on error
            if (retryCount < 1 && mounted) {
              setTimeout(() => refreshCredits(retryCount + 1, true), 1000);
            }
          }
        }
      } catch (error) {
        // Retry once on error
        if (retryCount < 1 && mounted) {
          setTimeout(() => refreshCredits(retryCount + 1, true), 1000);
        }
      }
    };

    // Get current user
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (mounted) {
          if (error) {
            setUser(null);
            setCreditsBalance(null);
          } else {
            setUser(user);
            // If user is logged in, fetch credits balance (force refresh on initial load)
            if (user) {
              await refreshCredits(0, true);
            } else {
              setCreditsBalance(null);
            }
          }
          setLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setUser(null);
          setCreditsBalance(null);
          setLoading(false);
        }
      }
    };

    getUser();

    // Listen for authentication state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      // 立即更新用户状态和加载状态
      setUser(session?.user ?? null);
      setLoading(false); // 确保 loading 状态被更新
      
      // If user logs in, fetch credits balance (force refresh on auth change)
      if (session?.user) {
        // Add a small delay to ensure session is fully established
        setTimeout(() => {
          if (mounted) {
            refreshCredits(0, true);
          }
        }, 500);
      } else {
        setCreditsBalance(null);
      }
    });

    // Listen for credits update events (with throttling)
    // 使用节流机制，避免短时间内重复调用
    let creditsUpdateTimer: NodeJS.Timeout | null = null;
    const handleCreditsUpdated = async () => {
      if (!mounted) return;
      
      // 如果已经有待执行的更新，清除它
      if (creditsUpdateTimer) {
        clearTimeout(creditsUpdateTimer);
      }
      
      // 延迟执行，如果在这期间又有新的更新事件，会清除之前的定时器
      creditsUpdateTimer = setTimeout(async () => {
        if (mounted) {
          await refreshCredits(0, false); // 使用节流，不强制刷新
        }
        creditsUpdateTimer = null;
      }, 1000); // 延迟1秒执行，合并多次事件
    };

    window.addEventListener('credits-updated', handleCreditsUpdated);

    return () => {
      mounted = false;
      if (creditsUpdateTimer) {
        clearTimeout(creditsUpdateTimer);
      }
      subscription.unsubscribe();
      window.removeEventListener('credits-updated', handleCreditsUpdated);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      setCreditsBalance(null);
      router.push("/");
      router.refresh();
    } catch (error) {
    }
  };

  return (
    <header className="border-b border-yellow-500/20 bg-gradient-to-br from-black via-gray-900 to-black backdrop-blur-xl relative z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-6">
              <Link 
                href="/generate" 
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium hover:bg-yellow-500/10 px-3 py-1.5 rounded-lg"
              >
                Generate
              </Link>
              <Link 
                href="/storyboard" 
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium hover:bg-yellow-500/10 px-3 py-1.5 rounded-lg"
              >
                Story Script
              </Link>
              {/* <Link 
                href="/ai-music-video-generator" 
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium hover:bg-yellow-500/10 px-3 py-1.5 rounded-lg"
              >
                Music
              </Link> */}
              <Link 
                href="/prompt-guide" 
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium hover:bg-yellow-500/10 px-3 py-1.5 rounded-lg"
              >
                Prompt Guide
              </Link>
              <Link 
                href="/pricing" 
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium hover:bg-yellow-500/10 px-3 py-1.5 rounded-lg"
              >
                Pricing
              </Link>
              <Link 
                href="/faq" 
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium hover:bg-yellow-500/10 px-3 py-1.5 rounded-lg"
              >
                FAQ
              </Link>
            </nav>
            {/* User status and credits balance/logout button */}
            {loading ? (
              <div className="w-20 h-9">{/* Placeholder during loading to prevent layout shift */}</div>
            ) : user ? (
              <div className="flex items-center gap-4">
                {/* Credits balance display - always shown, even if creditsBalance is null */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/20 rounded-lg">
                  <Diamond className="w-4 h-4 text-yellow-400" />
                  <span className="text-sm font-medium text-white">
                    {creditsBalance !== null ? creditsBalance.toLocaleString() : "0"} Credits
                  </span>
                </div>
                <Button
                  onClick={handleLogout}
                  className="bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/20 text-white hover:bg-yellow-500/20 hover:border-yellow-500/30 h-9 px-4 flex items-center gap-2 transition-all"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              </div>
            ) : (
              <Button
                asChild
                className="bg-gradient-to-r from-yellow-600 to-amber-600 text-black hover:from-yellow-500 hover:to-amber-500 border-0 h-9 px-4 shadow-lg hover:shadow-yellow-500/50 transition-all font-semibold"
              >
                <Link href="/login" className="flex items-center gap-2">
                  <LogIn className="w-4 h-4" />
                  <span>Login</span>
                </Link>
              </Button>
            )}
          </div>
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="text-gray-300 hover:text-yellow-400 hover:bg-yellow-500/10"
            >
              {mobileMenuOpen ? (
                <X className="w-5 h-5" />
              ) : (
                <Menu className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
        
        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden mt-4 pb-4 border-t border-yellow-500/20">
            <nav className="flex flex-col gap-4 pt-4">
              <Link 
                href="/generate" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium py-2 px-3 rounded-lg hover:bg-yellow-500/10"
              >
                Generate
              </Link>
              <Link 
                href="/storyboard" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium py-2 px-3 rounded-lg hover:bg-yellow-500/10"
              >
                Story Script
              </Link>
              {/* <Link 
                href="/ai-music-video-generator" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium py-2 px-3 rounded-lg hover:bg-yellow-500/10"
              >
                Music
              </Link> */}
              <Link 
                href="/prompt-guide" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium py-2 px-3 rounded-lg hover:bg-yellow-500/10"
              >
                Prompt Guide
              </Link>
              <Link 
                href="/pricing" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium py-2 px-3 rounded-lg hover:bg-yellow-500/10"
              >
                Pricing
              </Link>
              <Link 
                href="/faq" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-yellow-400 transition-colors text-sm font-medium py-2 px-3 rounded-lg hover:bg-yellow-500/10"
              >
                FAQ
              </Link>
              
              {!loading ? (
                <>
                  {/* Credits balance display (mobile menu) - always shown when logged in */}
                  {user && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/20 rounded-lg">
                      <Diamond className="w-4 h-4 text-yellow-400" />
                      <span className="text-sm font-medium text-white">
                        {creditsBalance !== null ? creditsBalance.toLocaleString() : "0"} Credits
                      </span>
                    </div>
                  )}
                  
                  {/* Login/Logout button (mobile menu) */}
                  {user ? (
                    <Button
                      onClick={() => {
                        setMobileMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full bg-yellow-500/10 backdrop-blur-sm border border-yellow-500/20 text-white hover:bg-yellow-500/20 hover:border-yellow-500/30 h-10 flex items-center justify-center gap-2 transition-all"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="w-full bg-gradient-to-r from-yellow-600 to-amber-600 text-black hover:from-yellow-500 hover:to-amber-500 border-0 h-10 shadow-lg hover:shadow-yellow-500/50 transition-all font-semibold"
                    >
                      <Link 
                        href="/login" 
                        onClick={() => setMobileMenuOpen(false)}
                        className="flex items-center justify-center gap-2"
                      >
                        <LogIn className="w-4 h-4" />
                        <span>Login</span>
                      </Link>
                    </Button>
                  )}
                </>
              ) : (
                <div className="h-10">{/* 加载时占位，避免布局跳动 */}</div>
              )}
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

