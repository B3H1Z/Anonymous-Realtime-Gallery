import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flag, X, AlertTriangle, Shield, Eye, MessageSquare } from 'lucide-react'

const ReportModal = ({ isOpen, onClose, onReport, photoId, isLoading }) => {
  const [selectedReason, setSelectedReason] = useState('')

  const reportReasons = [
    {
      id: 'inappropriate_content',
      label: 'Inappropriate Content',
      description: '  Inappropriate Content ‌   is',
      icon: AlertTriangle,
      color: 'text-red-400'
    },
    {
      id: 'spam',
      label: 'Spam',
      description: '   Spam is',
      icon: MessageSquare,
      color: 'text-yellow-400'
    },
    {
      id: 'violence',
      label: 'Violent',
      description: '   Violent  ‌ is',
      icon: Shield,
      color: 'text-orange-400'
    },
    {
      id: 'copyright_violation',
      label: 'Copyright Violation',
      description: 'Photo contains copyrighted content',
      icon: Eye,
      color: 'text-purple-400'
    },
    {
      id: 'other',
      label: 'Other',
      description: 'There is another reason to report this photo',
      icon: Flag,
      color: 'text-gray-400'
    }
  ]

  const handleSubmit = () => {
    if (!selectedReason) return

    onReport(photoId, selectedReason)
    setSelectedReason('')
  }

  const handleClose = () => {
    setSelectedReason('')
    onClose()
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 rounded-2xl border border-gray-700/50 p-6 w-full max-w-md"
          onClick={(e) => e.stopPropagation()}
          
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-white transition-colors order-2"
              disabled={isLoading}
            >
              <X size={24} />
            </button>
            <div className="flex items-center gap-2 order-1">
              <h3 className="text-xl font-bold text-white order-2">Report Photo</h3>
              <Flag className="text-orange-400 order-1" size={24} />
            </div>
          </div>

          {/* Reason Selection */}
          <div className="space-y-3 mb-6">
            <p className="text-gray-300 text-sm mb-4 text-right">
              Please select the reason for reporting this photo:
            </p>

            {reportReasons.map((reason) => {
              const Icon = reason.icon
              return (
                <motion.button
                  key={reason.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedReason(reason.id)}
                  disabled={isLoading}
                  className={`w-full p-4 rounded-xl border-2 transition-all text-right ${
                    selectedReason === reason.id
                      ? 'border-orange-400 bg-orange-400/10 text-white'
                      : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
                  } ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1 text-right order-2">
                      <div className="font-medium text-white">{reason.label}</div>
                      <div className="text-sm text-gray-400 mt-1">{reason.description}</div>
                    </div>
                    <Icon className={`mt-1 ${reason.color} flex-shrink-0 order-1`} size={20} />
                  </div>
                </motion.button>
              )
            })}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 flex-row-reverse">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmit}
              disabled={!selectedReason || isLoading}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? 'in  ...' : ''}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </motion.button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

export default ReportModal