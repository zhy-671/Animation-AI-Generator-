import { Metadata } from "next";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import AnimationFAQ from "@/components/faq/animation-faq";

export const metadata: Metadata = {
  title: "Animation Generator Questions & Answers | animationaIgenerator",
  description: "Have questions about creating AI animations? Find quick answers on generating cartoons, videos, and storyboards with our tool. Get tips and troubleshooting here!",
  keywords: "animation generator faq, can ai generate animations, how to animate with ai, ai animation questions, animation tool help, animation generator guide, can chatgpt animate, free ai cartoon generator, how to animate picture using ai free, convert picture to animation, is ai animation free, which ai animation tool is best, can i make 3d animation for free, what are the 4 types of animation",
};

export default function FAQPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            "mainEntity": [{
              "@type": "Question",
              "name": "Can AI generate animations?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes! AI can generate animations from text descriptions or images. Our Animation AI Generator uses advanced AI technology to create professional animated videos in seconds. Simply describe your idea or upload an image, and our AI will transform it into a captivating animated video."
              }
            }, {
              "@type": "Question",
              "name": "Is AI animation free?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes! Our basic AI animation features are completely free. You can create animated videos from text or images without any cost. We offer free credits to get started, and you can purchase additional credits or subscribe to plans for more advanced features."
              }
            }, {
              "@type": "Question",
              "name": "How to animate a picture using AI free?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Simply upload your image to our Image-to-Video Animation Generator, and our AI will automatically transform it into an animated video. The process is free and takes just seconds. You can customize styles, add effects, and create professional animations without any expertise needed."
              }
            }, {
              "@type": "Question",
              "name": "Is there a free AI cartoon generator?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes! Our Animation AI Generator offers free cartoon and animation generation. You can create animated videos and cartoons from text or images without any cost. Basic features are free, and you can upgrade for more advanced options."
              }
            }, {
              "@type": "Question",
              "name": "How to convert picture to animation?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Upload your picture to our Image-to-Video Animation Generator. Our AI analyzes your image and creates an animated video version. You can choose from various animation styles (2D, 3D, Anime, Cartoon, etc.) and customize the animation to match your vision."
              }
            }, {
              "@type": "Question",
              "name": "Can I make 3D animation for free?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Yes! Our Animation AI Generator includes free 3D animation capabilities. You can create 3D animated videos from text descriptions or images without any cost. Select the 3D animation style and watch your ideas come to life in three dimensions."
              }
            }, {
              "@type": "Question",
              "name": "Which AI animation tool is best?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "Our Animation AI Generator stands out with its ease of use, fast generation times, and high-quality results. We support multiple animation styles (2D, 3D, Anime, Cartoon), offer both text-to-video and image-to-video options, and provide a complete storyboard workflow. Try it free and see why creators choose us!"
              }
            }, {
              "@type": "Question",
              "name": "What are the 4 types of animation?",
              "acceptedAnswer": {
                "@type": "Answer",
                "text": "The four main types of animation are: 1) Traditional/2D Animation - hand-drawn frame-by-frame animation, 2) 3D Animation - computer-generated three-dimensional animation, 3) Stop Motion - physical objects photographed frame-by-frame, and 4) Motion Graphics - animated graphic design elements. Our tool supports 2D, 3D, and various modern animation styles."
              }
            }]
          })
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": "Animation AI Generator FAQs",
            "description": "Have questions about creating AI animations? Find quick answers on generating cartoons, videos, and storyboards with our tool. Get tips and troubleshooting here!",
            "aggregateRating": {
              "@type": "AggregateRating",
              "ratingValue": "4.7",
              "reviewCount": "1100",
              "bestRating": "5",
              "worstRating": "1"
            }
          })
        }}
      />
      <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
        <Header />
        <main className="flex-1">
          <AnimationFAQ />
        </main>
        <Footer />
      </div>
    </>
  );
}
