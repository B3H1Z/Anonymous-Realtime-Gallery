import React from 'react'
import { motion } from 'framer-motion'
import { Eye, Check, X, Trash2 } from 'lucide-react'

const AdminPhotoCard = ({ 
  photo, 
  type, // 'pending' or 'live'
  onView,
  onApprove,
  onReject,
  onDelete
}) => {
  // Format date in a more readable way
  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)
    
    if (diffInHours < 24) {
      // Today: show time only
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else if (diffInHours < 48) {
      // Yesterday: show "Yesterday at time"
      return `Yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    } else {
      // Older: show date and time
      return date.toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      }) + ` at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
    }
  }

  // This component only renders photos that have already been filtered for image existence

  return (
    <motion.div
      key={photo.id}
      layout
      className="bg-gray-700/30 rounded-lg overflow-hidden border border-gray-600/30 hover:border-gray-500/50 transition-colors"
      dir="ltr"
    >
      <div className="aspect-square bg-gray-600 relative">
        <img
          src={`/images/${photo.filename}`}
          alt={type === 'pending' ? 'Pending review' : 'Live photo'}
          className="w-full h-full object-cover"
          onError={(e) => {
            const photoCard = e.target.closest('.bg-gray-700\\/30')
            if (photoCard) {
              photoCard.style.display = 'none'
            }
          }}
        />
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          <button
            onClick={() => onView(photo)}
            className="p-2 bg-white/20 rounded-full text-white hover:bg-white/30 transition-colors"
          >
            <Eye className="w-4 h-4" />
          </button>
        </div>
      </div>
      <div className="p-3">
        {type === 'pending' ? (
          <>
            <div className="text-xs text-gray-400 mb-2">
              {formatDate(photo.created_at)}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(photo.id)}
                className="flex-1 bg-green-500/20 hover:bg-green-500/30 text-green-400 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <Check className="w-3 h-3" />
                Approve
              </button>
              <button
                onClick={() => onReject(photo.id)}
                className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
              >
                <X className="w-3 h-3" />
                Reject
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
              <span>{photo.likes} likes</span>
              {photo.report_count > 0 && (
                <span className="text-red-400">{photo.report_count} reports</span>
              )}
            </div>
            <button
              onClick={() => onDelete(photo.id)}
              className="w-full bg-red-500/20 hover:bg-red-500/30 text-red-400 py-1.5 rounded text-xs font-medium transition-colors flex items-center justify-center gap-1"
            >
              <Trash2 className="w-3 h-3" />
              Delete
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}

export default AdminPhotoCard