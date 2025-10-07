import React from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, CheckCircle, Shield, Eye, FileText } from 'lucide-react'
import { Link } from 'react-router-dom'

const Terms = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Navigation */}
      <div className="relative z-50 p-6">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-gray-300 hover:text-white transition-colors"
        >
          <ArrowLeft size={20} />
          Back to Gallery
        </Link>
      </div>

      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center py-12 px-6"
      >
        <motion.div
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
          className="w-20 h-20 bg-gradient-to-br from-blue-400 to-purple-400 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6"
        >
          <FileText />
        </motion.div>
        <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-4">
          Terms of Service Anonymous Gallery
        </h1>
        <p className="text-gray-300 text-lg max-w-2xl mx-auto">
          Please read and accept these simple rules before sharing your photos with others
        </p>
      </motion.div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-gray-800/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-8 md:p-12"
        >
          {/* Terms Content */}
          <div className="prose prose-invert max-w-none">
            <div className="space-y-8 text-gray-200 leading-relaxed">

              {/* Introduction */}
              <div className="border-b border-gray-700/50 pb-8">
                <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                  <CheckCircle className="text-green-400" size={24} />
                  Welcome to Anonymous Gallery!
                </h2>
                <p className="text-lg">
                  Before you start sharing your photos, please read these simple rules carefully.
                  These rules help everyone use and enjoy the site.
                </p>
              </div>

              {/* Rule 1 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-blue-500/10 border border-blue-400/20 rounded-xl p-6"
              >
                <h3 className="text-xl font-bold text-blue-400 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-blue-400/20 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  Upload Relevant Content
                </h3>
                <p className="mb-3">
                  <strong>You agree to upload only appropriate photos.</strong> Photos with inappropriate content,
                  that show faces or contain identifiable details will be rejected.
                </p>
                <div className="bg-blue-400/5 rounded-lg p-4 border-l-4 border-blue-400">
                  <p className="text-sm text-blue-300">
                    ✅ Creative photos<br/>
                    ❌ Irrelevant photos or those containing personal information
                  </p>
                </div>
              </motion.div>

              {/* Rule 2 */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-green-500/10 border border-green-400/20 rounded-xl p-6"
              >
                <h3 className="text-xl font-bold text-green-400 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-green-400/20 rounded-full flex items-center justify-center text-sm font-bold">2</span>
                  Own Your Content
                </h3>
                <p className="mb-3">
                  <strong>You confirm that you own the photos you upload</strong> and have the right to share them.
                  We have no responsibility for violating others' rights.
                </p>
                <div className="bg-green-400/5 rounded-lg p-4 border-l-4 border-green-400">
                  <p className="text-sm text-green-300">
                    ✅ Photos you took yourself<br/>
                    ❌ Stolen photos or those without permission
                  </p>
                </div>
              </motion.div>

              {/* Rule 3 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-red-500/10 border border-red-400/20 rounded-xl p-6"
              >
                <h3 className="text-xl font-bold text-red-400 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-red-400/20 rounded-full flex items-center justify-center text-sm font-bold">3</span>
                  Don't Upload Prohibited Content
                </h3>
                <p className="mb-3">
                  <strong>You agree not to upload any illegal, pornographic, hate speech, violent or inappropriate content.</strong>
                  We reserve the right to remove any inappropriate content without prior notice.
                </p>
                <div className="bg-red-400/5 rounded-lg p-4 border-l-4 border-red-400">
                  <p className="text-sm text-red-300">
                    ❌ Inappropriate, violent or illegal content<br/>
                    ✅ Entertaining and appropriate content
                  </p>
                </div>
              </motion.div>

              {/* Rule 4 */}
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-purple-500/10 border border-purple-400/20 rounded-xl p-6"
              >
                <h3 className="text-xl font-bold text-purple-400 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-purple-400/20 rounded-full flex items-center justify-center text-sm font-bold">4</span>
                  Respect Anonymity
                </h3>
                <p className="mb-3">
                  <strong>You understand that all uploads are anonymous.</strong> No user accounts exist and you cannot
                  delete the photo after approval. We do not collect personal information.
                </p>
                <div className="bg-purple-400/5 rounded-lg p-4 border-l-4 border-purple-400">
                  <p className="text-sm text-purple-300">
                    🔒 Completely anonymous<br/>
                    🚫 Cannot delete photo after approval
                  </p>
                </div>
              </motion.div>

              {/* Rule 5 */}
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.8 }}
                className="bg-yellow-500/10 border border-yellow-400/20 rounded-xl p-6"
              >
                <h3 className="text-xl font-bold text-yellow-400 mb-3 flex items-center gap-2">
                  <span className="w-8 h-8 bg-yellow-400/20 rounded-full flex items-center justify-center text-sm font-bold">5</span>
                  Accept Moderation
                </h3>
                <p className="mb-3">
                  <strong>All submissions are reviewed by a moderator</strong> who has the final say. We can
                  approve, reject or delete any content at any time without prior notice.
                </p>
                <div className="bg-yellow-400/5 rounded-lg p-4 border-l-4 border-yellow-400">
                  <p className="text-sm text-yellow-300">
                    👨‍💼 Manual review by moderator<br/>
                    ⚖️ Final content moderation rights
                  </p>
                </div>
              </motion.div>

              {/* Privacy Note */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="bg-gray-700/30 rounded-xl p-6 border border-gray-600/30"
              >
                <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                  <Shield className="text-gray-400" size={20} />
                  Privacy & Security
                </h3>
                <p className="text-gray-300">
                  We respect user privacy. No personal information is collected and
                  all activities remain anonymous. However, if legally required, we may
                  share technical information with relevant authorities.
                </p>
              </motion.div>

              {/* Contact */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="text-center pt-8 border-t border-gray-700/50"
              >
                <h3 className="text-xl font-bold text-white mb-4">Have Questions?</h3>
                <p className="text-gray-300 mb-6">
                  If you have questions about these rules or need to report inappropriate content,
                  please contact us through the admin panel.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link
                    to="/"
                    className="bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-8 py-3 rounded-xl font-semibold transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    I Accept & Start! 📸
                  </Link>
                  <button
                    onClick={() => window.history.back()}
                    className="bg-gray-700/50 hover:bg-gray-700 text-gray-300 px-8 py-3 rounded-xl font-semibold transition-all duration-300 border border-gray-600"
                  >
                    Maybe Later
                  </button>
                </div>
              </motion.div>
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="text-center mt-12 text-gray-400 text-sm"
        >
          <p>© 2025 Anonymous Gallery - A Place to Share Anonymously! ✨</p>
        </motion.div>
      </div>
    </div>
  )
}

export default Terms