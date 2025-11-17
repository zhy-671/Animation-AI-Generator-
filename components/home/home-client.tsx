"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/header/header";
import AnimationHero from "@/components/hero/animation-hero";
import FeaturesShowcase from "@/components/features/features-showcase";
import UseCases from "@/components/usecases/use-cases";
import ProcessFlow from "@/components/process/process-flow";
import Examples from "@/components/examples/examples";
import CTA from "@/components/cta/cta-section";
import Footer from "@/components/footer/footer";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function HomeClient() {
  const router = useRouter();
  const [showBottomButton, setShowBottomButton] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const heroSection = document.querySelector('section:first-of-type');
      if (!heroSection) return;

      const heroRect = heroSection.getBoundingClientRect();
      const scrollY = window.scrollY || window.pageYOffset;
      
      // 如果滚动超过英雄区域底部（英雄区域完全不可见），显示按钮
      // 如果回到接近顶部（距离顶部小于200px），隐藏按钮
      if (heroRect.bottom < 0) {
        setShowBottomButton(true);
      } else if (scrollY < 200) {
        setShowBottomButton(false);
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // 初始检查

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            "name": "Animation AI Generator | Animaker AI",
            "url": "https://animationaigenerator.com",
            "description": "Create stunning animated videos with AI-powered 2D and 3D animation tools. Animaker AI - the ultimate animation generator.",
            "potentialAction": {
              "@type": "SearchAction",
              "target": {
                "@type": "EntryPoint",
                "urlTemplate": "https://animationaigenerator.com/animation-ai-generator/text-to-video"
              },
              "query-input": "required name=search_term_string"
            }
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": "Animation AI Generator | Animaker AI",
            "url": "https://animationaigenerator.com",
            "logo": "https://animationaigenerator.com/images/logo.png",
            "description": "AI-powered animation generator (Animaker AI) for creating 2D and 3D animated videos",
            "sameAs": []
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            "name": "Animation AI Generator | Animaker AI",
            "applicationCategory": "MultimediaApplication",
            "operatingSystem": "Web Browser",
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD"
            },
            "description": "Create animated videos from text or images using AI-powered animation tools. Animaker AI technology for seamless video generation.",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "reviewCount": "1250",
              "bestRating": "5",
              "worstRating": "1"
            },
            "featureList": [
              "Text-to-video animation",
              "Image-to-video animation",
              "2D and 3D animation styles",
              "Short-form video creation",
              "TikTok, Instagram Reels, YouTube Shorts optimization"
            ]
          })
        }}
      />
      <div className="min-h-screen bg-white dark:bg-gray-900">
        <Header />
        <AnimationHero />
        <FeaturesShowcase />
        <Examples />
        <UseCases />
        <ProcessFlow />
        <CTA />
        <Footer />
      </div>

      {/* 移动端底部固定按钮 */}
      <AnimatePresence>
        {showBottomButton && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 md:hidden"
          >
            <Button
              onClick={() => router.push(`/animation-ai-generator/text-to-video`)}
              className="w-full h-12 text-base font-medium bg-[#FFDA2A] text-gray-900 hover:bg-[#FFDA2A]/90 transition-all duration-200 rounded-full shadow-lg"
            >
              Generate Video Free
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

