import React from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate()

  return (
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
            Privacy Policy
          </span>
        </h1>
        
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-pink-100 p-8 md:p-12 space-y-8 text-gray-700 leading-relaxed">
          <div>
            <p className="text-sm text-gray-500 mb-6">
              <strong>Last Updated:</strong> {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
            <p className="mb-4">
              Mapies ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our interactive map application and related services (the "Service").
            </p>
          </div>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                1. Information We Collect
              </span>
            </h2>
            
            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">1.1 Account Information</h3>
            <p className="mb-4">
              When you create an account, we collect:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Email address</li>
              <li>Password (encrypted and stored securely)</li>
              <li>Name and profile information (if provided)</li>
            </ul>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">1.2 Map Data</h3>
            <p className="mb-4">
              We collect and store data you create through the Service:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Map configurations and settings</li>
              <li>Marker locations and associated information (names, addresses, coordinates)</li>
              <li>Polygon and region boundaries</li>
              <li>Custom icons and branding materials you upload</li>
              <li>CSV import data you provide</li>
            </ul>

            <h3 className="text-xl font-semibold text-pink-600 mt-6 mb-3">1.3 Usage Information</h3>
            <p className="mb-4">
              We automatically collect information about how you use the Service:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Device information (browser type, operating system)</li>
              <li>IP address and approximate geographic location</li>
              <li>Pages visited and features used</li>
              <li>Time and date of access</li>
              <li>Subscription and payment information (processed through Stripe)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                2. How We Use Your Information
              </span>
            </h2>
            <p className="mb-4">We use the collected information to:</p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Provide, maintain, and improve the Service</li>
              <li>Process your registration and manage your account</li>
              <li>Enable map creation, marker management, and data import features</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send service-related communications (account updates, feature announcements)</li>
              <li>Respond to your inquiries and provide customer support</li>
              <li>Detect, prevent, and address technical issues and security threats</li>
              <li>Comply with legal obligations and enforce our Terms of Service</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                3. Data Storage and Security
              </span>
            </h2>
            <p className="mb-4">
              Your data is stored securely using Firebase (Google Cloud Platform). We implement:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication through Firebase Authentication</li>
              <li>Firestore security rules to restrict unauthorized access</li>
              <li>Regular security audits and updates</li>
            </ul>
            <p className="mb-4">
              However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to use commercially acceptable means to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                4. Data Sharing and Disclosure
              </span>
            </h2>
            <p className="mb-4">We do not sell your personal information. We may share your information only in the following circumstances:</p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li><strong>Service Providers:</strong> We share data with third-party service providers who perform services on our behalf (e.g., Firebase for hosting, Stripe for payments, Mapbox for mapping services)</li>
              <li><strong>Public Maps:</strong> If you choose to make a map public, the map data (markers, polygons) will be accessible to anyone with the public URL</li>
              <li><strong>Embedded Maps:</strong> Maps embedded on external websites using embed codes will be publicly viewable</li>
              <li><strong>Legal Requirements:</strong> We may disclose information if required by law, court order, or government regulation</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or sale of assets, your information may be transferred</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                5. Your Rights and Choices
              </span>
            </h2>
            <p className="mb-4">You have the right to:</p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li><strong>Access:</strong> Access and review your personal data and map content</li>
              <li><strong>Update:</strong> Correct or update your account information</li>
              <li><strong>Delete:</strong> Delete your account and associated data (contact support@mapies.com)</li>
              <li><strong>Export:</strong> Export your map data in various formats</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications (account-related emails may still be sent)</li>
              <li><strong>Privacy Settings:</strong> Control map visibility and sharing preferences</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                6. Third-Party Services
              </span>
            </h2>
            <p className="mb-4">
              Our Service integrates with third-party services:
            </p>
            <ul className="list-disc list-inside mb-4 space-y-2 ml-4">
              <li><strong>Firebase:</strong> Authentication, database, and storage (Google Privacy Policy applies)</li>
              <li><strong>Stripe:</strong> Payment processing (Stripe Privacy Policy applies)</li>
              <li><strong>Mapbox:</strong> Mapping and geocoding services (Mapbox Privacy Policy applies)</li>
              <li><strong>OpenStreetMap/Nominatim:</strong> Geocoding services (OpenStreetMap Privacy Policy applies)</li>
            </ul>
            <p className="mb-4">
              These services have their own privacy policies. We encourage you to review them.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                7. Children's Privacy
              </span>
            </h2>
            <p className="mb-4">
              Our Service is not intended for children under 13 years of age. We do not knowingly collect personal information from children under 13. If you believe we have collected such information, please contact us immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                8. International Data Transfers
              </span>
            </h2>
            <p className="mb-4">
              Your information may be transferred to and processed in countries other than your country of residence. By using the Service, you consent to the transfer of your information to these countries, which may have different data protection laws.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                9. Changes to This Privacy Policy
              </span>
            </h2>
            <p className="mb-4">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">
              <span className="bg-gradient-to-r from-pink-600 to-rose-600 bg-clip-text text-transparent">
                10. Contact Us
              </span>
            </h2>
            <p className="mb-4">
              If you have questions about this Privacy Policy or wish to exercise your rights, please contact us at:
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
  )
}

export default PrivacyPolicy
