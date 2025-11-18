import { Metadata } from "next";
import AnimationGeneratorForm from "@/components/generator/animation-generator-form";

export const metadata: Metadata = {
  title: "Turn Text into Animation Videos | animationaIgenerator",
  description: "Turn your text into animated videos with our AI generator. Describe your idea and watch it come to life – create captivating animations in minutes!",
  keywords: "text to animation, animation ai generator from text, text to video animation, ai text to animation creator, animation ai generator from text free, create animation from text",
};

export default function TextToVideoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Animation AI Generator from Text",
            "description": "Turn your text into animated videos with our AI generator. Describe your idea and watch it come to life – create captivating animations in minutes!",
            "brand": {
              "@type": "Brand",
              "name": "AnimationAIGenerator"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.7",
              "reviewCount": "980",
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": "Animation AI Generator from Text",
            "description": "Turn your text into animated videos with our AI generator. Describe your idea and watch it come to life – create captivating animations in minutes!",
            "contentUrl": "https://animationaigenerator.com/animation-ai-generator/text-to-video",
            "uploadDate": new Date().toISOString(),
            "creator": {
              "@type": "Organization",
              "name": "AnimationAIGenerator"
            }
          })
        }}
      />
      <AnimationGeneratorForm />
    </>
  );
}

