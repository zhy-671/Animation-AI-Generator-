import { Metadata } from "next";
import { Suspense } from "react";
import StoryScriptPage from "@/components/storyboard/story-script-page";

export const metadata: Metadata = {
  title: "Create Animation Storyboards with AI | animationaIgenerator",
  description: "Kickstart your creative process with our AI storyboard generator. Turn any outline or script into a full storyboard quickly and easily – visual storytelling made simple.",
  keywords: "anime story generator, animation storyboard tool, story script generator, anime script creator, ai storyboard generator, animation script writer",
  robots: {
    index: true,
    follow: true,
  },
};

export default function AnimeStoryPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Animation Storyboard AI Generator",
            "description": "Kickstart your creative process with our AI storyboard generator. Turn any outline or script into a full storyboard quickly and easily – visual storytelling made simple.",
            "brand": {
              "@type": "Brand",
              "name": "AnimationAIGenerator"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.5",
              "reviewCount": "620",
              "bestRating": "5",
              "worstRating": "1"
            },
            "offers": {
              "@type": "Offer",
              "price": "0",
              "priceCurrency": "USD",
              "availability": "https://schema.org/InStock"
            }
          })
        }}
      />
      <Suspense fallback={<div className="min-h-screen bg-black text-white flex items-center justify-center">Loading...</div>}>
        <StoryScriptPage />
      </Suspense>
    </>
  );
}

