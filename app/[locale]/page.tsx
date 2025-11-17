import AnimationHero from "@/components/hero/animation-hero";
import FeaturesShowcase from "@/components/features/features-showcase";
import UseCases from "@/components/usecases/use-cases";
import ProcessFlow from "@/components/process/process-flow";
import Examples from "@/components/examples/examples";
import CTA from "@/components/cta/cta-section";
import Footer from "@/components/footer/footer";

export default function Home() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <AnimationHero />
      <FeaturesShowcase />
      <Examples />
      <UseCases />
      <ProcessFlow />
      <CTA />
      <Footer />
    </div>
  );
}

