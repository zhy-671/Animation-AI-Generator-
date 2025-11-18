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

    // Function to refresh credits balance
    const refreshCredits = async () => {
      try {
        const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
        if (userError) {
          console.error("Error getting user for credits refresh:", userError);
          return;
        }
        if (currentUser && mounted) {
          try {
            const balanceCheck = await checkCreditsBalance(0);
            if (balanceCheck.balance !== undefined && mounted) {
              setCreditsBalance(balanceCheck.balance);
            }
          } catch (error) {
            console.error("Error loading credits balance:", error);
          }
        }
      } catch (error) {
        console.error("Error in refreshCredits:", error);
      }
    };

    // Get current user
    const getUser = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (mounted) {
          if (error) {
            console.error("Error getting user:", error);
            setUser(null);
            setCreditsBalance(null);
          } else {
            setUser(user);
            // If user is logged in, fetch credits balance
            if (user) {
              await refreshCredits();
            } else {
              setCreditsBalance(null);
            }
          }
          setLoading(false);
        }
      } catch (error) {
        console.error("Error in getUser:", error);
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
      
      console.log('Auth state changed:', event, session?.user?.id);
      
      // 立即更新用户状态和加载状态
      setUser(session?.user ?? null);
      setLoading(false); // 确保 loading 状态被更新
      
      // If user logs in, fetch credits balance
      if (session?.user) {
        console.log('User logged in, refreshing credits...');
        await refreshCredits();
      } else {
        setCreditsBalance(null);
      }
    });

    // Listen for credits update events
    const handleCreditsUpdated = async () => {
      if (!mounted) return;
      await refreshCredits();
    };

    window.addEventListener('credits-updated', handleCreditsUpdated);

    return () => {
      mounted = false;
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
      console.error("Error signing out:", error);
    }
  };

  return (
    <header className="border-b border-gray-800 bg-black relative z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Logo />
          <div className="hidden md:flex items-center gap-6">
            <nav className="flex items-center gap-6">
              <Link 
                href="/generate" 
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                Generate
              </Link>
              <Link 
                href="/storyboard" 
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                Story Script
              </Link>
              <Link 
                href="/prompt-guide" 
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                Prompt Guide
              </Link>
              <Link 
                href="/pricing" 
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
              >
                Pricing
              </Link>
              <Link 
                href="/faq" 
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium"
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
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700 rounded-lg">
                  <Diamond className="w-4 h-4 text-[#FFDA2A]" />
                  <span className="text-sm font-medium text-white">
                    {creditsBalance !== null ? creditsBalance.toLocaleString() : "0"} Credits
                  </span>
                </div>
                <Button
                  onClick={handleLogout}
                  className="bg-transparent border border-gray-700 text-white hover:bg-gray-800 hover:text-white h-9 px-4 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Logout</span>
                </Button>
              </div>
            ) : (
              <Button
                asChild
                className="bg-transparent border border-gray-700 text-white hover:bg-gray-800 hover:text-white h-9 px-4"
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
              className="text-gray-300 hover:text-white"
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
          <div className="md:hidden mt-4 pb-4 border-t border-gray-800">
            <nav className="flex flex-col gap-4 pt-4">
              <Link 
                href="/generate" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium py-2"
              >
                Generate
              </Link>
              <Link 
                href="/storyboard" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium py-2"
              >
                Story Script
              </Link>
              <Link 
                href="/prompt-guide" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium py-2"
              >
                Prompt Guide
              </Link>
              <Link 
                href="/pricing" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium py-2"
              >
                Pricing
              </Link>
              <Link 
                href="/faq" 
                onClick={() => setMobileMenuOpen(false)}
                className="text-gray-300 hover:text-white transition-colors text-sm font-medium py-2"
              >
                FAQ
              </Link>
              
              {!loading ? (
                <>
                  {/* Credits balance display (mobile menu) - always shown when logged in */}
                  {user && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-800/50 border border-gray-700 rounded-lg">
                      <Diamond className="w-4 h-4 text-[#FFDA2A]" />
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
                      className="w-full bg-transparent border border-gray-700 text-white hover:bg-gray-800 hover:text-white h-10 flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      <span>Logout</span>
                    </Button>
                  ) : (
                    <Button
                      asChild
                      className="w-full bg-transparent border border-gray-700 text-white hover:bg-gray-800 hover:text-white h-10"
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

