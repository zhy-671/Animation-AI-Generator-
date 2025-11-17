import { redirect } from 'next/navigation';

export default async function AnimationAIGeneratorPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/animation-ai-generator/text-to-video`);
}

