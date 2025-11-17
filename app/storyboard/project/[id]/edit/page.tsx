import { Metadata } from "next";
import StoryboardEditForm from "@/components/storyboard/edit-form";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  
  return {
    title: `Edit Story Script | AI Animation Generator`,
    description: "Edit your story script project",
    robots: {
      index: false, // 编辑页面不需要SEO索引
    },
  };
}

export default async function EditStoryboardPage({ params }: Props) {
  const { id } = await params;
  return <StoryboardEditForm projectId={id} />;
}

