import { Metadata } from "next";
import ProjectCreateForm from "@/components/storyboard/project-create-form";

interface CreateProjectPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({ params }: CreateProjectPageProps): Promise<Metadata> {
  const { id } = await params;
  return {
    title: `Create Story Script | AI Animation Generator`,
    description: `Create your story script with detailed settings.`,
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function CreateProjectPage({ params }: CreateProjectPageProps) {
  const { id } = await params;
  return <ProjectCreateForm projectId={id} />;
}

