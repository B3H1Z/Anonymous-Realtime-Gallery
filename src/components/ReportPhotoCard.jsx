import React from 'react'
import { motion } from 'framer-motion'
import { Trash2, Eye, AlertTriangle } from 'lucide-react'

const ReportPhotoCard = ({ 
  photoGroup, 
  index, 
  onDelete,
  formatReasonText 
}) => {
  // Format date in a more readable way
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffInHours < 48) {
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      }) + ` at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
  }

  return (
    <motion.div
      key={photoGroup.photo_id}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      className="bg-gray-700/30 rounded-lg overflow-hidden border border-gray-600/30 hover:border-orange-500/50 transition-colors"
      dir="ltr"
    >
      {/* Image Section */}
      <div className="aspect-square bg-gray-600 relative">
        <img
          src={`/images/${photoGroup.filename}`}
          alt="Reported photo"
          className="w-full h-full object-cover"
          onError={(e) => {
            const photoCard = e.target.closest('.bg-gray-700\\/30')
            if (photoCard) {
              photoCard.style.display = 'none'
            }
          }}
        />
        {/* Report Count Badge */}
        <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold rounded-full w-8 h-8 flex items-center justify-center shadow-lg">
          {photoGroup.reportCount}
        </div>
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <div className="flex items-center gap-2 text-white">
            <AlertTriangle className="w-5 h-5" />
            <span className="text-sm font-medium">Reported</span>
          </div>
        </div>
      </div>

      {/* Info Section */}
      <div className="p-3">
        {/* Report Info */}
        <div className="mb-2">
          <div className="text-xs text-gray-400 mb-1 truncate text-left" title={photoGroup.original_name}>
            {photoGroup.original_name}
          </div>
          <div className="text-xs text-orange-400 font-medium text-left">
            Last report: {formatDate(photoGroup.latestReportDate)}
          </div>
        </div>

        {/* Report Reasons Tags */}
        <div className="flex flex-wrap gap-1 mb-3 justify-start">
          {Array.from(photoGroup.reasons).slice(0, 2).map(reason => (
            <span
              key={reason}
              className="bg-orange-500/20 text-orange-400 px-2 py-0.5 rounded-full text-xs font-medium"
              title={formatReasonText(reason)}
            >
              {formatReasonText(reason)}
            </span>
          ))}
          {Array.from(photoGroup.reasons).length > 2 && (
            <span className="bg-gray-600/50 text-gray-400 px-2 py-0.5 rounded-full text-xs">
              +{Array.from(photoGroup.reasons).length - 2}
            </span>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={() => onDelete(photoGroup.photo_id)}
          className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
        >
          <Trash2 className="w-3 h-3" />
          Delete Photo
        </button>
      </div>
    </motion.div>
  )
}

export default ReportPhotoCard