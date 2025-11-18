import { Metadata } from "next";
import HomeClient from "@/components/home/home-client";

export const metadata: Metadata = {
  title: "Create AI Animation Videos Free | animationaIgenerator",
  description: "Generate high-quality animated videos and cartoons from text or images with our AI animation generator. Create professional animations instantly!",
  keywords: "animation ai generator from text, animation video ai generator, animation cartoon ai generator, ai animation generator free, text to animation, ai video generator",
};

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "AI Animation Video Generator",
            "description": "Generate high-quality animated videos and cartoons from text or images with our AI animation generator. Create professional animations instantly!",
            "brand": {
              "@type": "Brand",
              "name": "AnimationAIGenerator"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.8",
              "reviewCount": "1250",
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
      <HomeClient />
    </>
  );
}
