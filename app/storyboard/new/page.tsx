import { Metadata } from "next";
import IdeaInputForm from "@/components/storyboard/idea-input-form";

export const metadata: Metadata = {
  title: "New Story Script | AI Animation Generator",
  description: "Share your creative ideas and let AI help you create amazing story scripts",
  robots: {
    index: false, // 创作页面不需要SEO索引
  },
};

export default function NewStoryboardPage() {
  return <IdeaInputForm />;
}

