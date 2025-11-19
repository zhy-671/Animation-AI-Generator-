import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Mail, MessageSquare, HelpCircle } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact Us | Animation AI Generator",
  description: "Get in touch with Animation AI Generator. Contact us for support, questions, or feedback about our AI animation generation platform.",
};

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-16 md:py-24 flex-grow">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-3">
              <MessageSquare className="w-10 h-10 text-[#FFDA2A]" />
              Contact Us
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              We're here to help! Get in touch with us for support, questions, or feedback.
            </p>
          </div>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5 text-[#FFDA2A]" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg space-y-4">
                <div>
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">Email</p>
                  <p>
                    <a 
                      href="mailto:andy@adflurrytech.com" 
                      className="text-[#FFDA2A] hover:underline text-lg"
                    >
                      andy@adflurrytech.com
                    </a>
                  </p>
                  <p className="text-sm mt-1 text-gray-500 dark:text-gray-400">
                    For general inquiries, support, and business inquiries
                  </p>
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <p className="font-semibold text-gray-900 dark:text-white mb-2">Website</p>
                  <p>
                    <a 
                      href="https://animationaigenerator.com" 
                      className="text-[#FFDA2A] hover:underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      https://animationaigenerator.com
                    </a>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Support Categories */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-[#FFDA2A]" />
                How Can We Help?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Technical Support</h3>
                  <p className="text-sm">
                    Having issues with video generation, account access, or technical problems? We're here to help.
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Billing & Subscriptions</h3>
                  <p className="text-sm">
                    Questions about payments, subscription plans, credits, or refunds? Contact us for assistance.
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Feature Requests</h3>
                  <p className="text-sm">
                    Have ideas for new features or improvements? We'd love to hear your feedback and suggestions.
                  </p>
                </div>
                
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Business Inquiries</h3>
                  <p className="text-sm">
                    Interested in partnerships, enterprise solutions, or API access? Let's discuss how we can work together.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Response Time */}
          <Card>
            <CardHeader>
              <CardTitle>Response Time</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                We aim to respond to all inquiries within 24-48 hours during business days. For urgent matters, please indicate "URGENT" in your email subject line.
              </p>
              <p>
                For technical support issues, please include:
              </p>
              <ul className="list-disc list-inside space-y-1 ml-4">
                <li>Your account email address</li>
                <li>Description of the issue</li>
                <li>Screenshots or error messages (if applicable)</li>
                <li>Steps to reproduce the problem</li>
              </ul>
            </CardContent>
          </Card>

          {/* FAQ Link */}
          <Card className="bg-gradient-to-br from-[#FFDA2A]/10 to-transparent border-[#FFDA2A]/20">
            <CardContent className="pt-6">
              <p className="text-center text-gray-600 dark:text-gray-400">
                Before contacting us, you might find answers to common questions in our{" "}
                <a href="/faq" className="text-[#FFDA2A] hover:underline font-semibold">
                  FAQ section
                </a>
                .
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

