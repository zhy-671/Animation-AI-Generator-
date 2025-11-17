import { Metadata } from "next";
import AnimationGeneratorForm from "@/components/generator/animation-generator-form";

export const metadata: Metadata = {
  title: "Animation AI Generator & Video Maker | Animaker AI – Create Short Videos",
  description: "Bring your ideas to life with our AI-powered video animation tool (Animaker AI). Describe a scene and generate a stunning short video in seconds. No editing skills needed!",
  keywords: "AI animation generator, Animaker AI, AI video maker, text-to-video, video animation tool, short video creator, video content generator, create animated video",
};

export default function TextToVideoPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "VideoObject",
            "name": "Animation AI Generator | Animaker AI - Create Videos from Text",
            "description": "Create animated videos from text descriptions using AI-powered video animation tool (Animaker AI)",
            "contentUrl": "https://animationaigenerator.com/animation-ai-generator/text-to-video",
            "uploadDate": new Date().toISOString(),
            "creator": {
              "@type": "Organization",
              "name": "Animation AI Generator | Animaker AI"
            }
          })
        }}
      />
      <AnimationGeneratorForm />
    </>
  );
}

