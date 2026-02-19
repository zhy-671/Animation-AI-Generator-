import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Disclosure | Animation AI Generator",
  description: "Learn about the AI technologies and services we use to power Animation AI Generator, including DashScope, WanX, and Volcano Engine.",
};

export default function AIDisclosurePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-16 md:py-24 flex-grow">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-3">
              <Brain className="w-10 h-10 text-[#FFDA2A]" />
              AI Technology Disclosure
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Transparency about the AI services powering our platform
            </p>
          </div>

          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle>1. Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                Animation AI Generator uses artificial intelligence (AI) technologies to generate animated videos, images, and storyboards from text prompts and images. This disclosure provides transparency about the AI services and technologies we use to power our platform.
              </p>
              <p>
                By using our Service, you acknowledge that you understand and agree to the use of these AI technologies as described in this disclosure.
              </p>
            </CardContent>
          </Card>

          {/* AI Services We Use */}
          <Card>
            <CardHeader>
              <CardTitle>2. AI Services and Technologies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                We use the following third-party AI services to power different features of our platform:
              </p>

              <div className="space-y-6 mt-6">
                {/* DashScope */}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">2.1 Alibaba Cloud DashScope</h3>
                  <p className="mb-2">
                    <strong>Provider:</strong> Alibaba Cloud (Alibaba Group)
                  </p>
                  <p className="mb-2">
                    <strong>Services Used:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Qwen2:</strong> Large language model for text generation, story creation, and content generation</li>
                    <li><strong>WanX:</strong> Image generation models for creating images from text prompts and image-to-image transformations</li>
                    <li><strong>Video Generation:</strong> Text-to-video and image-to-video generation models</li>
                    <li><strong>Hailuo Video:</strong> Advanced video generation service for creating animated videos from text and images</li>
                  </ul>
                  <p className="mt-2">
                    <strong>Use Cases:</strong> Story generation, storyboard creation, character image generation, scene image generation, video generation
                  </p>
                  <p className="mt-2">
                    <strong>Privacy:</strong> Your prompts and content may be processed by DashScope's servers. Please refer to Alibaba Cloud's privacy policy for details on how they handle your data.
                  </p>
                </div>

                {/* Volcano Engine */}
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">2.2 ByteDance Volcano Engine</h3>
                  <p className="mb-2">
                    <strong>Provider:</strong> ByteDance (TikTok parent company)
                  </p>
                  <p className="mb-2">
                    <strong>Services Used:</strong>
                  </p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li><strong>Story Generation:</strong> AI-powered story and script generation</li>
                    <li><strong>Image Generation:</strong> AI-powered image generation for storyboards</li>
                    <li><strong>Cloud Storage (TOS):</strong> Video and media file storage</li>
                  </ul>
                  <p className="mt-2">
                    <strong>Use Cases:</strong> Story generation, image generation, cloud storage for generated content
                  </p>
                  <p className="mt-2">
                    <strong>Privacy:</strong> Your content may be processed by Volcano Engine's servers. Please refer to ByteDance's privacy policy for details on how they handle your data.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* How AI is Used */}
          <Card>
            <CardHeader>
              <CardTitle>3. How We Use AI</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">3.1 Text-to-Video Generation:</strong> When you provide a text prompt, our AI models generate animated videos based on your description. The AI interprets your text and creates corresponding visual content.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">3.2 Image-to-Video Generation:</strong> When you upload an image, our AI models analyze the image and generate animated videos that bring the image to life.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">3.3 Storyboard Generation:</strong> Our AI models generate story outlines, scenes, and storyboards based on your creative input, including character descriptions, plot points, and visual styles.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">3.4 Image Generation:</strong> Our AI models generate images for storyboards, characters, and scenes based on text descriptions and reference images.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">3.5 Content Processing:</strong> Your prompts, images, and generated content may be processed by AI models to improve generation quality and provide personalized results.
              </p>
            </CardContent>
          </Card>

          {/* AI Limitations */}
          <Card>
            <CardHeader>
              <CardTitle>4. AI Limitations and Accuracy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">4.1 No Guarantees:</strong> AI-generated content may not always meet your expectations. The quality, accuracy, and suitability of AI-generated content can vary based on the complexity of your request, the AI model's capabilities, and other factors.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">4.2 Imperfections:</strong> AI-generated content may contain errors, inconsistencies, or unexpected results. We do not guarantee that AI-generated content will be perfect, accurate, or suitable for any particular purpose.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">4.3 Human Review:</strong> We recommend reviewing and editing AI-generated content before using it for important purposes. AI-generated content should be treated as a starting point that may require human refinement.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">4.4 Continuous Improvement:</strong> AI models are continuously being improved, but they may still produce unexpected or undesirable results. We are not responsible for any consequences arising from the use of AI-generated content.
              </p>
            </CardContent>
          </Card>

          {/* Data Processing */}
          <Card>
            <CardHeader>
              <CardTitle>5. Data Processing and Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">5.1 Content Processing:</strong> When you use our Service, your text prompts, uploaded images, and generated content may be processed by third-party AI services. This processing is necessary to provide the Service.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.2 Third-Party Services:</strong> We use third-party AI services (DashScope, Volcano Engine) that have their own privacy policies and data handling practices. By using our Service, you acknowledge that your content may be processed by these third-party services.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.3 Data Storage:</strong> Generated content may be stored on third-party cloud storage services (e.g., Volcano TOS) for delivery and access purposes.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.4 Model Training:</strong> We do not use your content to train AI models without your explicit consent. However, third-party AI service providers may use aggregated and anonymized data for model improvement purposes, as described in their respective privacy policies.
              </p>
              <p>
                For more information about how we handle your data, please see our <a href="/privacy" className="text-[#FFDA2A] hover:underline">Privacy Policy</a>.
              </p>
            </CardContent>
          </Card>

          {/* Intellectual Property */}
          <Card>
            <CardHeader>
              <CardTitle>6. Intellectual Property and Ownership</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">6.1 Your Content:</strong> You retain ownership of the content you create using our Service, including AI-generated content. However, you are responsible for ensuring that your use of AI-generated content complies with all applicable laws and regulations.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">6.2 AI Service Providers:</strong> The AI models and technologies we use are owned by their respective providers (Alibaba Cloud, ByteDance). Your use of AI-generated content is subject to the terms and conditions of these providers.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">6.3 Commercial Use:</strong> You may use AI-generated content for commercial purposes, subject to the terms of your subscription plan and applicable laws. However, you are responsible for ensuring that AI-generated content does not infringe upon the rights of others.
              </p>
              <p>
                For more information about intellectual property rights, please see our <a href="/terms" className="text-[#FFDA2A] hover:underline">Terms of Service</a>.
              </p>
            </CardContent>
          </Card>

          {/* User Responsibilities */}
          <Card>
            <CardHeader>
              <CardTitle>7. User Responsibilities</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                When using AI-generated content, you are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Ensuring that your prompts and content comply with our Terms of Service and applicable laws</li>
                <li>Reviewing and verifying AI-generated content before using it for important purposes</li>
                <li>Not using AI-generated content in ways that may harm others or violate their rights</li>
                <li>Complying with the terms and conditions of third-party AI service providers</li>
                <li>Understanding that AI-generated content may contain errors or inaccuracies</li>
                <li>Not relying solely on AI-generated content for critical decisions or professional advice</li>
              </ul>
            </CardContent>
          </Card>

          {/* Updates to AI Services */}
          <Card>
            <CardHeader>
              <CardTitle>8. Updates and Changes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                We may update or change the AI services and technologies we use from time to time. We will notify you of any material changes to this disclosure by posting an updated version on this page and updating the "Last Updated" date.
              </p>
              <p>
                We may also add new AI services or replace existing ones to improve the Service. Your continued use of the Service after any such changes constitutes your acceptance of the updated disclosure.
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>9. Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                If you have any questions about our use of AI technologies or this disclosure, please contact us at:
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="font-semibold text-gray-900 dark:text-white">Animation AI Generator</p>
                <p>Email: <a href="mailto:andy@adflurrytech.com" className="text-[#FFDA2A] hover:underline">andy@adflurrytech.com</a></p>
                <p>Website: <a href="https://animationaigenerator.com" className="text-[#FFDA2A] hover:underline">https://animationaigenerator.com</a></p>
              </div>
            </CardContent>
          </Card>

          {/* Acknowledgment */}
          <Card className="bg-gradient-to-br from-[#FFDA2A]/10 to-transparent border-[#FFDA2A]/20">
            <CardContent className="pt-6">
              <p className="text-center text-gray-600 dark:text-gray-400">
                Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
              <p className="text-center text-gray-600 dark:text-gray-400 mt-2">
                By using our Service, you acknowledge that you have read, understood, and agree to this AI Technology Disclosure.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

