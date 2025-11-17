import { Metadata } from "next";
import IdeaInputForm from "@/components/storyboard/idea-input-form";

export const metadata: Metadata = {
  title: "New Anime Story | AI Animation Generator",
  description: "Create a new anime story script with AI assistance",
  robots: {
    index: false, // 创作页面不需要SEO索引
  },
};

export default function NewAnimeStoryPage() {
  return <IdeaInputForm />;
}

