import { Metadata } from "next";
import StoryboardCreateForm from "@/components/storyboard/create-form";

export const metadata: Metadata = {
  title: "Create Story Script | AI Animation Generator",
  description: "Create your story script with AI-powered scene generation",
  robots: {
    index: false, // 创作页面不需要SEO索引
  },
};

export default function CreateStoryboardPage() {
  return <StoryboardCreateForm />;
}

