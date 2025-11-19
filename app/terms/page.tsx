import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service | Animation AI Generator",
  description: "Read our Terms of Service to understand the rules and regulations for using Animation AI Generator. Learn about user rights, payment terms, and acceptable use policies.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-16 md:py-24 flex-grow">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-3">
              <FileText className="w-10 h-10 text-[#FFDA2A]" />
              Terms of Service
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Introduction */}
          <Card>
            <CardHeader>
              <CardTitle>1. Introduction</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                Welcome to Animation AI Generator ("we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of our website, services, and applications (collectively, the "Service"). By accessing or using our Service, you agree to be bound by these Terms.
              </p>
              <p>
                If you do not agree to these Terms, please do not use our Service. We reserve the right to modify these Terms at any time, and such modifications will be effective immediately upon posting. Your continued use of the Service after any such modifications constitutes your acceptance of the modified Terms.
              </p>
            </CardContent>
          </Card>

          {/* Acceptance of Terms */}
          <Card>
            <CardHeader>
              <CardTitle>2. Acceptance of Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                By creating an account, accessing, or using our Service, you represent and warrant that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>You are at least 18 years old or have the legal capacity to enter into binding contracts in your jurisdiction</li>
                <li>You have the authority to bind yourself or the entity you represent to these Terms</li>
                <li>All information you provide to us is accurate, current, and complete</li>
                <li>You will maintain the security of your account credentials</li>
                <li>You will comply with all applicable laws and regulations</li>
              </ul>
            </CardContent>
          </Card>

          {/* Description of Service */}
          <Card>
            <CardHeader>
              <CardTitle>3. Description of Service</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                Animation AI Generator provides an artificial intelligence-powered platform that enables users to generate animated videos from text prompts and images. Our Service includes:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Text-to-video generation using AI models</li>
                <li>Image-to-video generation using AI models</li>
                <li>Storyboard creation and scene generation</li>
                <li>Video editing and customization tools</li>
                <li>Cloud storage for generated content</li>
                <li>Subscription plans and credit-based payment systems</li>
              </ul>
              <p>
                We reserve the right to modify, suspend, or discontinue any aspect of the Service at any time, with or without notice, and without liability to you.
              </p>
            </CardContent>
          </Card>

          {/* User Accounts */}
          <Card>
            <CardHeader>
              <CardTitle>4. User Accounts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                To access certain features of the Service, you must create an account. You are responsible for:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Maintaining the confidentiality of your account credentials</li>
                <li>All activities that occur under your account</li>
                <li>Notifying us immediately of any unauthorized use of your account</li>
                <li>Ensuring that your account information is accurate and up-to-date</li>
              </ul>
              <p>
                We reserve the right to suspend or terminate your account if you violate these Terms or engage in any fraudulent, abusive, or illegal activity.
              </p>
            </CardContent>
          </Card>

          {/* Payment Terms */}
          <Card>
            <CardHeader>
              <CardTitle>5. Payment Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">5.1 Subscription Plans:</strong> We offer various subscription plans with different features and credit allocations. Subscription fees are billed in advance on a monthly or annual basis, as selected by you.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.2 Credit Packages:</strong> You may purchase credit packages that can be used to generate videos. Credits are non-refundable and expire according to the terms of your purchase.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.3 Payment Processing:</strong> All payments are processed through secure third-party payment processors. By making a payment, you agree to the terms and conditions of the payment processor.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.4 Refunds:</strong> All sales are final. We do not offer refunds for subscription fees or credit purchases, except as required by applicable law or at our sole discretion.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.5 Price Changes:</strong> We reserve the right to modify our pricing at any time. Price changes will not affect your current subscription period but may apply to renewals.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.6 Cancellation:</strong> You may cancel your subscription at any time. Cancellation will take effect at the end of your current billing period. You will continue to have access to the Service until the end of your paid period.
              </p>
            </CardContent>
          </Card>

          {/* User Content and Intellectual Property */}
          <Card>
            <CardHeader>
              <CardTitle>6. User Content and Intellectual Property</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">6.1 Your Content:</strong> You retain ownership of all content you create, upload, or generate using our Service ("User Content"). By using our Service, you grant us a worldwide, non-exclusive, royalty-free license to use, store, display, reproduce, and distribute your User Content solely for the purpose of providing and improving the Service.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">6.2 AI-Generated Content:</strong> Content generated using our AI models may be subject to the terms and conditions of our AI service providers. You are responsible for ensuring that your use of AI-generated content complies with all applicable laws and regulations.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">6.3 Prohibited Content:</strong> You agree not to create, upload, or generate any content that:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Violates any applicable laws or regulations</li>
                <li>Infringes upon the intellectual property rights of others</li>
                <li>Contains hate speech, harassment, or discriminatory content</li>
                <li>Is pornographic, obscene, or sexually explicit</li>
                <li>Contains violence or promotes illegal activities</li>
                <li>Is defamatory, libelous, or invasive of privacy</li>
                <li>Contains malware, viruses, or other harmful code</li>
              </ul>
              <p>
                <strong className="text-gray-900 dark:text-white">6.4 Our Rights:</strong> We reserve the right to remove, suspend, or delete any User Content that violates these Terms or is otherwise objectionable, without prior notice.
              </p>
            </CardContent>
          </Card>

          {/* Acceptable Use */}
          <Card>
            <CardHeader>
              <CardTitle>7. Acceptable Use</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>You agree not to:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Use the Service for any illegal purpose or in violation of any applicable laws</li>
                <li>Attempt to gain unauthorized access to our systems or networks</li>
                <li>Interfere with or disrupt the Service or servers connected to the Service</li>
                <li>Use automated systems (bots, scrapers) to access the Service without our express written permission</li>
                <li>Reverse engineer, decompile, or disassemble any part of the Service</li>
                <li>Resell, redistribute, or sublicense access to the Service</li>
                <li>Use the Service to compete with us or develop competing products</li>
                <li>Impersonate any person or entity or falsely state your affiliation with any person or entity</li>
                <li>Collect or harvest information about other users without their consent</li>
              </ul>
            </CardContent>
          </Card>

          {/* Intellectual Property Rights */}
          <Card>
            <CardHeader>
              <CardTitle>8. Intellectual Property Rights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">8.1 Our Property:</strong> The Service, including all software, technology, designs, graphics, text, logos, and other materials, is owned by us or our licensors and is protected by copyright, trademark, patent, and other intellectual property laws.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">8.2 Limited License:</strong> We grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal or commercial use, subject to these Terms.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">8.3 Restrictions:</strong> You may not copy, modify, distribute, sell, or lease any part of the Service without our express written permission.
              </p>
            </CardContent>
          </Card>

          {/* Disclaimers */}
          <Card>
            <CardHeader>
              <CardTitle>9. Disclaimers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">9.1 Service Availability:</strong> The Service is provided "as is" and "as available" without warranties of any kind, either express or implied. We do not guarantee that the Service will be uninterrupted, error-free, or secure.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">9.2 AI-Generated Content:</strong> AI-generated content may not always meet your expectations. We do not guarantee the accuracy, quality, or suitability of AI-generated content for any particular purpose.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">9.3 Third-Party Services:</strong> Our Service may integrate with third-party services, including AI model providers, cloud storage providers, and payment processors. We are not responsible for the availability, performance, or content of third-party services.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">9.4 No Professional Advice:</strong> The Service does not provide professional, legal, financial, or other advice. Any information provided through the Service is for informational purposes only.
              </p>
            </CardContent>
          </Card>

          {/* Limitation of Liability */}
          <Card>
            <CardHeader>
              <CardTitle>10. Limitation of Liability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, WE SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your use or inability to use the Service</li>
                <li>Any unauthorized access to or use of our servers or your account</li>
                <li>Any interruption or cessation of transmission to or from the Service</li>
                <li>Any bugs, viruses, or other harmful code transmitted through the Service</li>
                <li>Any errors or omissions in any content or for any loss or damage incurred as a result of the use of any content</li>
              </ul>
              <p>
                OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE USE OF OR INABILITY TO USE THE SERVICE SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRIOR TO THE EVENT GIVING RISE TO THE LIABILITY.
              </p>
            </CardContent>
          </Card>

          {/* Indemnification */}
          <Card>
            <CardHeader>
              <CardTitle>11. Indemnification</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                You agree to indemnify, defend, and hold harmless Animation AI Generator, its affiliates, officers, directors, employees, agents, and licensors from and against any and all claims, damages, obligations, losses, liabilities, costs, or debt, and expenses (including but not limited to attorney's fees) arising from:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Your use of and access to the Service</li>
                <li>Your violation of any term of these Terms</li>
                <li>Your violation of any third-party right, including without limitation any copyright, property, or privacy right</li>
                <li>Any claim that your User Content caused damage to a third party</li>
              </ul>
            </CardContent>
          </Card>

          {/* Termination */}
          <Card>
            <CardHeader>
              <CardTitle>12. Termination</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">12.1 Termination by You:</strong> You may terminate your account at any time by contacting us or using the account deletion feature in your account settings.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">12.2 Termination by Us:</strong> We may terminate or suspend your account and access to the Service immediately, without prior notice or liability, for any reason, including if you breach these Terms.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">12.3 Effect of Termination:</strong> Upon termination, your right to use the Service will immediately cease. All provisions of these Terms that by their nature should survive termination shall survive termination, including ownership provisions, warranty disclaimers, indemnity, and limitations of liability.
              </p>
            </CardContent>
          </Card>

          {/* Governing Law */}
          <Card>
            <CardHeader>
              <CardTitle>13. Governing Law and Dispute Resolution</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">13.1 Governing Law:</strong> These Terms shall be governed by and construed in accordance with the laws of [Your Jurisdiction], without regard to its conflict of law provisions.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">13.2 Dispute Resolution:</strong> Any disputes arising out of or relating to these Terms or the Service shall be resolved through binding arbitration in accordance with the rules of [Arbitration Organization], except where prohibited by law.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">13.3 Class Action Waiver:</strong> You agree that any disputes will be resolved on an individual basis and waive your right to participate in a class action lawsuit or class-wide arbitration.
              </p>
            </CardContent>
          </Card>

          {/* Changes to Terms */}
          <Card>
            <CardHeader>
              <CardTitle>14. Changes to Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                We reserve the right to modify these Terms at any time. We will notify you of any material changes by posting the new Terms on this page and updating the "Last Updated" date. Your continued use of the Service after any such changes constitutes your acceptance of the new Terms.
              </p>
              <p>
                If you do not agree to the modified Terms, you must stop using the Service and may terminate your account.
              </p>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card>
            <CardHeader>
              <CardTitle>15. Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                If you have any questions about these Terms, please contact us at:
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="font-semibold text-gray-900 dark:text-white">Animation AI Generator</p>
                <p>Email: <a href="mailto:andy@adflurrytech.com" className="text-[#FFDA2A] hover:underline">andy@adflurrytech.com</a></p>
                <p>Website: <a href="https://animationaigenerator.com" className="text-[#FFDA2A] hover:underline">https://animationaigenerator.com</a></p>
              </div>
            </CardContent>
          </Card>

          {/* Severability */}
          <Card>
            <CardHeader>
              <CardTitle>16. Severability</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect and enforceable.
              </p>
            </CardContent>
          </Card>

          {/* Entire Agreement */}
          <Card>
            <CardHeader>
              <CardTitle>17. Entire Agreement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                These Terms, together with our Privacy Policy, constitute the entire agreement between you and Animation AI Generator regarding the use of the Service and supersede all prior agreements and understandings, whether written or oral.
              </p>
            </CardContent>
          </Card>

          {/* Acknowledgment */}
          <Card className="bg-gradient-to-br from-[#FFDA2A]/10 to-transparent border-[#FFDA2A]/20">
            <CardContent className="pt-6">
              <p className="text-center text-gray-600 dark:text-gray-400">
                By using our Service, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

