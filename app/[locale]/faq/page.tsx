import { Metadata } from "next";
import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import AnimationFAQ from "@/components/faq/animation-faq";

export const metadata: Metadata = {
  title: "FAQ | Animation AI Generator",
  description: "Frequently asked questions about creating animations. Learn how to make animation scenes online, create animated shorts, and use our animation creator.",
  keywords: "animation generator faq, how to make animation, animation questions, animation help",
};

export default function FAQPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex flex-col">
      <Header />
      <main className="flex-1">
        <AnimationFAQ />
      </main>
      <Footer />
    </div>
  );
}

