import { Metadata } from "next";
import { notFound } from "next/navigation";
import StoryboardProjectView from "@/components/storyboard/project-view";
import { createClient } from "@/lib/supabase/server";
import { getSceneWithItems } from "@/lib/supabase/scenes";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return {
      title: "Story Script Project",
      description: "View story script project",
    };
  }

  try {
    const scene = await getSceneWithItems(id);
    
    if (!scene || scene.user_id !== user.id) {
      return {
        title: "Story Script Project",
        description: "View story script project",
      };
    }

    const coverImage = scene.cover_image_url || 
      (scene.items && scene.items.length > 0 && scene.items[0].image_url) || 
      null;

    return {
      title: `${scene.title} | Story Script`,
      description: scene.summary || "View story script project",
      openGraph: {
        title: scene.title,
        description: scene.summary || "",
        images: coverImage ? [{ url: coverImage }] : [],
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: scene.title,
        description: scene.summary || "",
        images: coverImage ? [coverImage] : [],
      },
    };
  } catch (error) {
    return {
      title: "Story Script Project",
      description: "View story script project",
    };
  }
}

export default async function StoryboardProjectPage({ params }: Props) {
  const { id } = await params;
  return <StoryboardProjectView projectId={id} />;
}

