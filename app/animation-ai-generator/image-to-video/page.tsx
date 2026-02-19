import { Metadata } from "next";
import AnimationGeneratorForm from "@/components/generator/animation-generator-form";

export const metadata: Metadata = {
  title: "Animate Images into Videos Free | animationaIgenerator",
  description: "Animate your images effortlessly with our AI video generator. Transform photos into cinematic clips and customize styles in seconds – no expertise needed!",
  keywords: "image to animation, picture to animation ai generator, animation ai generator from image, animation ai generator from image free, convert picture to animation, photo to animation",
};

export default function ImageToVideoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Product",
            "name": "Animation Video AI Generator from Image",
            "description": "Animate your images effortlessly with our AI video generator. Transform photos into cinematic clips and customize styles in seconds – no expertise needed!",
            "brand": {
              "@type": "Brand",
              "name": "AnimationAIGenerator"
            },
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.6",
              "reviewCount": "850",
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
            "name": "Animation Video AI Generator from Image",
            "description": "Animate your images effortlessly with our AI video generator. Transform photos into cinematic clips and customize styles in seconds – no expertise needed!",
            "contentUrl": "https://animationaigenerator.com/animation-ai-generator/image-to-video",
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

