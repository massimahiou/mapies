import React from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SEO from './SEO'

const TermsOfService: React.FC = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const language = searchParams.get('lang') === 'fr' ? 'fr' : 'en'

  return (
    <>
      <SEO 
        title={language === 'fr' ? 'PINZ - Conditions d\'Utilisation' : 'PINZ - Terms of Service'}
        description={language === 'fr' 
          ? 'Conditions d\'utilisation de PINZ. Découvrez les règles et conditions d\'utilisation de notre plateforme.'
          : 'PINZ Terms of Service. Learn the rules and conditions for using our platform.'}
        language={language}
        canonical={`https://pinzapp.com/terms${language === 'en' ? '' : '?lang=fr'}`}
      />
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-white to-rose-50">
      {/* Header */}
      <header className="bg-white/95 backdrop-blur-sm shadow-sm border-b border-pink-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center text-gray-600 hover:text-pink-600 transition-colors group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-4xl md:text-5xl font-bold mb-8">
          <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
            Terms of Service
          </span>
        </h1>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-pink-100 p-8 md:p-12 space-y-8 text-gray-700 leading-relaxed">
          <div>
            <p className="text-sm text-gray-500 mb-6">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="mb-4">
              These Terms of Service ("Terms") govern your access to and use of Mapies ("we," "our," or "us") interactive map application and related services (the "Service"). By accessing or using the Service, you agree to be bound by these Terms.
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                1. Acceptance of Terms
              </span>
            </h2>
            <p className="mb-4">
              By creating an account, accessing, or using the Service, you accept and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, you may not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                2. Account Registration
              </span>
            </h2>
            <p className="mb-4">To use the Service, you must:</p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Provide accurate, current, and complete information during registration</li>
              <li>Maintain and promptly update your account information</li>
              <li>Maintain the security of your password and account</li>
              <li>Accept responsibility for all activities that occur under your account</li>
              <li>Be at least 13 years of age (or the age of majority in your jurisdiction)</li>
            </ul>
            <p className="mb-4">
              You may not create multiple accounts, share your account with others, or transfer your account to another person.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                3. Subscription Plans and Payment
              </span>
            </h2>
            
            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">3.1 Subscription Plans</h3>
            <p className="mb-4">
              Mapies offers various subscription plans with different features, limits, and pricing. Plan details, including limits on maps, markers, and features, are available on our pricing page.
            </p>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">3.2 Free Trial</h3>
            <p className="mb-4">
              Some plans may offer a free trial period. After the trial expires, your subscription will automatically convert to a paid plan unless cancelled before the trial ends.
            </p>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">3.3 Billing</h3>
            <p className="mb-4">
              Subscriptions are billed in advance on a monthly or annual basis. Payments are processed through Stripe. By subscribing, you authorize us to charge your payment method for all fees associated with your subscription.
            </p>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">3.4 Cancellation</h3>
            <p className="mb-4">
              You may cancel your subscription at any time through your account settings. Cancellation takes effect at the end of the current billing period. You will retain access to paid features until the end of your billing period. No refunds are provided for partial billing periods.
            </p>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">3.5 Plan Changes</h3>
            <p className="mb-4">
              You may upgrade or downgrade your plan at any time. Upgrades take effect immediately. Downgrades take effect at the start of the next billing period. Features exceeding your new plan's limits may become unavailable.
            </p>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">3.6 Price Changes</h3>
            <p className="mb-4">
              We reserve the right to modify subscription prices. Price changes will be communicated to you in advance and will apply to subsequent billing periods.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                4. Acceptable Use
              </span>
            </h2>
            <p className="mb-4">You agree not to:</p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Use the Service for any illegal or unauthorized purpose</li>
              <li>Violate any laws, regulations, or third-party rights</li>
              <li>Upload malicious code, viruses, or harmful files</li>
              <li>Attempt to gain unauthorized access to the Service or other users' accounts</li>
              <li>Impersonate any person or entity or misrepresent your affiliation</li>
              <li>Interfere with or disrupt the Service or servers</li>
              <li>Scrape, crawl, or harvest data from the Service without permission</li>
              <li>Reverse engineer, decompile, or disassemble the Service</li>
              <li>Use automated systems (bots, scripts) to access the Service without authorization</li>
              <li>Upload content that is defamatory, harassing, abusive, or infringes intellectual property</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                5. User Content
              </span>
            </h2>
            
            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">5.1 Ownership</h3>
            <p className="mb-4">
              You retain ownership of all content you create, upload, or store through the Service (maps, markers, data, files). By using the Service, you grant us a worldwide, non-exclusive, royalty-free license to store, process, and display your content solely for the purpose of providing the Service.
            </p>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">5.2 Content Responsibility</h3>
            <p className="mb-4">
              You are solely responsible for your content. You represent and warrant that:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>You own or have the right to use all content you upload</li>
              <li>Your content does not violate any laws or third-party rights</li>
              <li>Your content is accurate and not misleading</li>
            </ul>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">5.3 Public Sharing</h3>
            <p className="mb-4">
              If you choose to make a map public or embed it on external websites, that content becomes publicly accessible. You are responsible for the public display of your content.
            </p>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">5.4 Content Removal</h3>
            <p className="mb-4">
              We reserve the right to remove or disable access to any content that violates these Terms or is objectionable, at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                6. Service Availability and Modifications
              </span>
            </h2>
            <p className="mb-4">
              We strive to maintain high availability but do not guarantee uninterrupted or error-free service. We may:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Temporarily suspend the Service for maintenance or updates</li>
              <li>Modify, update, or discontinue features at any time</li>
              <li>Impose usage limits based on your subscription plan</li>
              <li>Block or restrict access for violations of these Terms</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                7. Intellectual Property
              </span>
            </h2>
            <p className="mb-4">
              The Service, including its design, features, functionality, and software, is owned by Mapies and protected by intellectual property laws. You may not copy, modify, distribute, sell, or lease any part of the Service without our written permission.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                8. Third-Party Services
              </span>
            </h2>
            <p className="mb-4">
              The Service integrates with third-party services (Firebase, Stripe, Mapbox, OpenStreetMap). Your use of these services is subject to their respective terms and privacy policies. We are not responsible for third-party services.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                9. Disclaimers and Limitation of Liability
              </span>
            </h2>
            
            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">9.1 Service Provided "As Is"</h3>
            <p className="mb-4">
              The Service is provided "as is" and "as available" without warranties of any kind, either express or implied, including but not limited to warranties of merchantability, fitness for a particular purpose, or non-infringement.
            </p>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">9.2 Limitation of Liability</h3>
            <p className="mb-4">
              To the maximum extent permitted by law, Mapies shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses resulting from your use of the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                10. Indemnification
              </span>
            </h2>
            <p className="mb-4">
              You agree to indemnify, defend, and hold harmless Mapies, its officers, directors, employees, and agents from and against any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your use of the Service, your content, or your violation of these Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                11. Termination
              </span>
            </h2>
            <p className="mb-4">
              We may suspend or terminate your account and access to the Service immediately, without prior notice, if you violate these Terms. Upon termination:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Your right to use the Service will cease</li>
              <li>We may delete your account and content</li>
              <li>You remain liable for all charges incurred up to the termination date</li>
            </ul>
            <p className="mb-4">
              You may terminate your account at any time by contacting support or deleting your account through your settings.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                12. Governing Law
              </span>
            </h2>
            <p className="mb-4">
              These Terms are governed by the laws of Canada and the Province of Quebec, without regard to conflict of law principles. Any disputes arising from these Terms or the Service shall be resolved in the courts of Montreal, Quebec.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                13. Changes to Terms
              </span>
            </h2>
            <p className="mb-4">
              We reserve the right to modify these Terms at any time. Material changes will be notified via email or through the Service. Your continued use of the Service after changes become effective constitutes acceptance of the new Terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                14. Contact Information
              </span>
            </h2>
            <p className="mb-4">
              If you have questions about these Terms, please contact us at:
            </p>
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-xl p-6 border border-pink-100 shadow-sm">
              <p className="font-semibold mb-2 text-gray-900">Mapies</p>
              <p className="text-gray-700">Email: <a href="mailto:support@mapies.com" className="text-pink-600 hover:text-pink-700 font-medium transition-colors">support@mapies.com</a></p>
              <p className="mt-2 text-gray-700">Montreal, Canada</p>
            </div>
          </section>
        </div>
      </main>
    </div>
    </>
  )
}

export default TermsOfService
