import { Metadata } from "next";
import HomeClient from "@/components/home/home-client";

export const metadata: Metadata = {
  title: "Create Music Videos with AI &Video AI Music |VerseMovie",
  description: "Generate original music and turn it into visually synced videos. Create AI-powered music videos with realistic vocal performance and style.",
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
            "name": "VerseMovie - video AI Music  Generator",
            "description": "Turn lyrics into cinematic AI music videos. Create professional MV videos from song lyrics instantly with our AI-powered music video generator.",
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
