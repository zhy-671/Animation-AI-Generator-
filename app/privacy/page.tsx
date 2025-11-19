import Header from "@/components/header/header";
import Footer from "@/components/footer/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield } from "lucide-react";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Animation AI Generator",
  description: "Learn how Animation AI Generator collects, uses, and protects your personal information. Our Privacy Policy explains your rights and our commitment to data protection.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900 flex flex-col">
      <Header />
      <main className="container mx-auto px-4 py-16 md:py-24 flex-grow">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4 flex items-center justify-center gap-3">
              <Shield className="w-10 h-10 text-[#FFDA2A]" />
              Privacy Policy
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
                Animation AI Generator ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our website, services, and applications (collectively, the "Service").
              </p>
              <p>
                Please read this Privacy Policy carefully. By using our Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our Service.
              </p>
            </CardContent>
          </Card>

          {/* Information We Collect */}
          <Card>
            <CardHeader>
              <CardTitle>2. Information We Collect</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">2.1 Information You Provide:</strong> We collect information that you voluntarily provide to us, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Account Information:</strong> Name, email address, password, and other registration information</li>
                <li><strong>Profile Information:</strong> Profile picture, bio, and other optional information you choose to provide</li>
                <li><strong>Content:</strong> Text prompts, images, videos, and other content you create, upload, or generate using our Service</li>
                <li><strong>Payment Information:</strong> Billing address, payment method details (processed securely through third-party payment processors)</li>
                <li><strong>Communications:</strong> Messages, feedback, support requests, and other communications you send to us</li>
              </ul>
              <p>
                <strong className="text-gray-900 dark:text-white">2.2 Automatically Collected Information:</strong> When you use our Service, we automatically collect certain information, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Usage Data:</strong> Information about how you interact with the Service, including pages visited, features used, and time spent</li>
                <li><strong>Device Information:</strong> Device type, operating system, browser type, IP address, and unique device identifiers</li>
                <li><strong>Log Data:</strong> Server logs, error reports, and performance data</li>
                <li><strong>Cookies and Tracking Technologies:</strong> We use cookies, web beacons, and similar technologies to collect information about your browsing behavior</li>
              </ul>
              <p>
                <strong className="text-gray-900 dark:text-white">2.3 Third-Party Information:</strong> We may receive information about you from third-party services, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Authentication providers (e.g., when you sign in with a third-party account)</li>
                <li>Payment processors</li>
                <li>Analytics providers</li>
                <li>Social media platforms (if you connect your account)</li>
              </ul>
            </CardContent>
          </Card>

          {/* How We Use Your Information */}
          <Card>
            <CardHeader>
              <CardTitle>3. How We Use Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>We use the information we collect for the following purposes:</p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>To Provide and Maintain the Service:</strong> Process your requests, generate videos, store your content, and manage your account</li>
                <li><strong>To Process Payments:</strong> Process subscription fees, credit purchases, and manage billing</li>
                <li><strong>To Communicate with You:</strong> Send you service-related notifications, respond to your inquiries, and provide customer support</li>
                <li><strong>To Improve the Service:</strong> Analyze usage patterns, identify issues, and develop new features</li>
                <li><strong>To Ensure Security:</strong> Detect and prevent fraud, abuse, and unauthorized access</li>
                <li><strong>To Comply with Legal Obligations:</strong> Meet legal requirements, respond to legal requests, and enforce our Terms of Service</li>
                <li><strong>For Marketing:</strong> Send you promotional communications (with your consent, where required by law)</li>
                <li><strong>For Research and Analytics:</strong> Conduct research, analyze trends, and generate aggregated, anonymized reports</li>
              </ul>
            </CardContent>
          </Card>

          {/* How We Share Your Information */}
          <Card>
            <CardHeader>
              <CardTitle>4. How We Share Your Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>We may share your information in the following circumstances:</p>
              <p>
                <strong className="text-gray-900 dark:text-white">4.1 Service Providers:</strong> We share information with third-party service providers who perform services on our behalf, including:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Cloud storage providers (e.g., Volcano TOS, Alibaba Cloud)</li>
                <li>AI model providers (e.g., Alibaba Cloud DashScope with Qwen2, WanX, and Hailuo Video models, ByteDance Volcano Engine)</li>
                <li>Payment processors (e.g., Creem)</li>
                <li>Analytics providers</li>
                <li>Email service providers</li>
                <li>Customer support platforms</li>
              </ul>
              <p className="mt-2">
                For more information about the AI services we use, please see our <a href="/ai-disclosure" className="text-[#FFDA2A] hover:underline">AI Technology Disclosure</a>.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">4.2 Legal Requirements:</strong> We may disclose your information if required by law, court order, or government regulation, or if we believe disclosure is necessary to:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Comply with legal obligations</li>
                <li>Protect our rights, property, or safety</li>
                <li>Protect the rights, property, or safety of our users or others</li>
                <li>Prevent or investigate fraud or other illegal activities</li>
              </ul>
              <p>
                <strong className="text-gray-900 dark:text-white">4.3 Business Transfers:</strong> In the event of a merger, acquisition, reorganization, or sale of assets, your information may be transferred to the acquiring entity.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">4.4 With Your Consent:</strong> We may share your information with third parties when you explicitly consent to such sharing.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">4.5 Aggregated or Anonymized Data:</strong> We may share aggregated or anonymized data that cannot be used to identify you for research, analytics, or other purposes.
              </p>
            </CardContent>
          </Card>

          {/* Data Storage and Security */}
          <Card>
            <CardHeader>
              <CardTitle>5. Data Storage and Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                <strong className="text-gray-900 dark:text-white">5.1 Data Storage:</strong> Your information is stored on secure servers located in [Your Region/Data Center Locations]. We use industry-standard security measures to protect your data, including encryption, access controls, and regular security audits.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.2 Security Measures:</strong> We implement appropriate technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or electronic storage is 100% secure.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.3 Data Retention:</strong> We retain your information for as long as necessary to provide the Service, comply with legal obligations, resolve disputes, and enforce our agreements. When you delete your account, we will delete or anonymize your personal information, except where we are required to retain it for legal purposes.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">5.4 Third-Party Storage:</strong> Some of your content may be stored on third-party cloud storage services (e.g., Volcano TOS). These services have their own privacy policies and security measures.
              </p>
            </CardContent>
          </Card>

          {/* Cookies and Tracking Technologies */}
          <Card>
            <CardHeader>
              <CardTitle>6. Cookies and Tracking Technologies</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                We use cookies and similar tracking technologies to collect and store information about your use of our Service. Cookies are small text files stored on your device that help us:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Remember your preferences and settings</li>
                <li>Authenticate your account</li>
                <li>Analyze how you use the Service</li>
                <li>Provide personalized content and advertisements</li>
                <li>Improve the Service's functionality and performance</li>
              </ul>
              <p>
                You can control cookies through your browser settings. However, disabling cookies may limit your ability to use certain features of the Service.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">Types of Cookies We Use:</strong>
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Essential Cookies:</strong> Required for the Service to function properly</li>
                <li><strong>Performance Cookies:</strong> Help us understand how visitors interact with the Service</li>
                <li><strong>Functionality Cookies:</strong> Remember your preferences and settings</li>
                <li><strong>Targeting Cookies:</strong> Used to deliver relevant advertisements</li>
              </ul>
            </CardContent>
          </Card>

          {/* Your Rights and Choices */}
          <Card>
            <CardHeader>
              <CardTitle>7. Your Rights and Choices</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>Depending on your location, you may have certain rights regarding your personal information:</p>
              <p>
                <strong className="text-gray-900 dark:text-white">7.1 Access:</strong> You can request access to the personal information we hold about you.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">7.2 Correction:</strong> You can request correction of inaccurate or incomplete information.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">7.3 Deletion:</strong> You can request deletion of your personal information, subject to certain exceptions.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">7.4 Portability:</strong> You can request a copy of your data in a structured, machine-readable format.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">7.5 Objection:</strong> You can object to certain processing activities, such as direct marketing.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">7.6 Restriction:</strong> You can request restriction of processing in certain circumstances.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">7.7 Withdraw Consent:</strong> Where processing is based on consent, you can withdraw your consent at any time.
              </p>
              <p>
                <strong className="text-gray-900 dark:text-white">7.8 Account Settings:</strong> You can update your account information, privacy settings, and communication preferences through your account settings.
              </p>
              <p>
                To exercise these rights, please contact us using the information provided in the "Contact Us" section below.
              </p>
            </CardContent>
          </Card>

          {/* Children's Privacy */}
          <Card>
            <CardHeader>
              <CardTitle>8. Children's Privacy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                Our Service is not intended for children under the age of 18. We do not knowingly collect personal information from children under 18. If you are a parent or guardian and believe that your child has provided us with personal information, please contact us immediately.
              </p>
              <p>
                If we become aware that we have collected personal information from a child under 18 without parental consent, we will take steps to delete such information promptly.
              </p>
            </CardContent>
          </Card>

          {/* International Data Transfers */}
          <Card>
            <CardHeader>
              <CardTitle>9. International Data Transfers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country.
              </p>
              <p>
                By using our Service, you consent to the transfer of your information to these countries. We take appropriate safeguards to ensure that your information receives an adequate level of protection in accordance with this Privacy Policy.
              </p>
            </CardContent>
          </Card>

          {/* Third-Party Links */}
          <Card>
            <CardHeader>
              <CardTitle>10. Third-Party Links</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices or content of these third-party sites. We encourage you to read the privacy policies of any third-party sites you visit.
              </p>
            </CardContent>
          </Card>

          {/* Changes to Privacy Policy */}
          <Card>
            <CardHeader>
              <CardTitle>11. Changes to Privacy Policy</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last Updated" date.
              </p>
              <p>
                We may also notify you of significant changes via email or through a notice on our Service. Your continued use of the Service after any such changes constitutes your acceptance of the updated Privacy Policy.
              </p>
            </CardContent>
          </Card>

          {/* California Privacy Rights */}
          <Card>
            <CardHeader>
              <CardTitle>12. California Privacy Rights (CCPA)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                If you are a California resident, you have additional rights under the California Consumer Privacy Act (CCPA):
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Right to Know:</strong> You can request information about the categories and specific pieces of personal information we collect, use, and disclose</li>
                <li><strong>Right to Delete:</strong> You can request deletion of your personal information</li>
                <li><strong>Right to Opt-Out:</strong> You can opt-out of the sale of your personal information (we do not sell personal information)</li>
                <li><strong>Non-Discrimination:</strong> We will not discriminate against you for exercising your CCPA rights</li>
              </ul>
              <p>
                To exercise your California privacy rights, please contact us using the information provided in the "Contact Us" section below.
              </p>
            </CardContent>
          </Card>

          {/* GDPR Rights (EU Users) */}
          <Card>
            <CardHeader>
              <CardTitle>13. GDPR Rights (EU Users)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>Right of access to your personal data</li>
                <li>Right to rectification of inaccurate data</li>
                <li>Right to erasure ("right to be forgotten")</li>
                <li>Right to restrict processing</li>
                <li>Right to data portability</li>
                <li>Right to object to processing</li>
                <li>Right to withdraw consent</li>
                <li>Right to lodge a complaint with a supervisory authority</li>
              </ul>
              <p>
                To exercise your GDPR rights, please contact us using the information provided in the "Contact Us" section below.
              </p>
            </CardContent>
          </Card>

          {/* Data Controller Information */}
          <Card>
            <CardHeader>
              <CardTitle>14. Data Controller Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                For the purposes of GDPR and other applicable data protection laws, the data controller is:
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="font-semibold text-gray-900 dark:text-white">Animation AI Generator</p>
                <p>Email: <a href="mailto:andy@adflurrytech.com" className="text-[#FFDA2A] hover:underline">andy@adflurrytech.com</a></p>
                <p>Website: <a href="https://animationaigenerator.com" className="text-[#FFDA2A] hover:underline">https://animationaigenerator.com</a></p>
              </div>
            </CardContent>
          </Card>

          {/* Contact Us */}
          <Card>
            <CardHeader>
              <CardTitle>15. Contact Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-gray-600 dark:text-gray-400">
              <p>
                If you have any questions, concerns, or requests regarding this Privacy Policy or our privacy practices, please contact us at:
              </p>
              <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <p className="font-semibold text-gray-900 dark:text-white">Animation AI Generator</p>
                <p>Email: <a href="mailto:andy@adflurrytech.com" className="text-[#FFDA2A] hover:underline">andy@adflurrytech.com</a></p>
                <p>Website: <a href="https://animationaigenerator.com" className="text-[#FFDA2A] hover:underline">https://animationaigenerator.com</a></p>
                <p className="mt-2 text-sm">
                  For data protection inquiries: <a href="mailto:andy@adflurrytech.com" className="text-[#FFDA2A] hover:underline">andy@adflurrytech.com</a>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Acknowledgment */}
          <Card className="bg-gradient-to-br from-[#FFDA2A]/10 to-transparent border-[#FFDA2A]/20">
            <CardContent className="pt-6">
              <p className="text-center text-gray-600 dark:text-gray-400">
                By using our Service, you acknowledge that you have read, understood, and agree to this Privacy Policy.
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
}

