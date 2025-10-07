import React from 'react'
import { motion } from 'framer-motion'
import { Heart, Flag } from 'lucide-react'

const PhotoCard = ({ 
  photo, 
  index, 
  filter, 
  likedPhotos, 
  handleLike, 
  handleReport, 
  likeMutation, 
  reportMutation,
  itemVariants 
}) => {
  // This component only renders photos that have already been filtered for image existence

  return (
    <motion.div
      variants={itemVariants}
      layout
      layoutId={`photo-${photo.id}`}
      className="group relative overflow-hidden rounded-2xl bg-gray-800/50 backdrop-blur-sm border border-gray-700/50 card-hover"
      style={{
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden'
      }}
    >
      <div className="gallery-image w-full overflow-hidden relative" style={{ aspectRatio: '9/16' }}>
        <img
          src={`/images/${photo.filename}`}
          alt="Photo"
          className="w-full h-full object-cover transition-transform duration-700 ease-out"
          loading="lazy"
          style={{ 
            aspectRatio: '9/16', 
            backgroundColor: '#374151',
            willChange: 'transform'
          }}
          onError={(e) => {
            // Hide the entire photo card if image is missing
            const photoCard = e.target.closest('.group')
            if (photoCard) {
              photoCard.style.display = 'none'
            }
          }}
        />
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
        {/* Like Button - Bottom Right */}
        <div className="absolute bottom-4 right-4 pointer-events-auto">
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleLike(photo.id)}
            disabled={likeMutation.isLoading}
            className="flex flex-col items-center space-y-1 text-white hover:text-red-400 transition-colors disabled:opacity-50"
          >
            <span className="text-sm font-medium">{photo.likes || 0}</span>
            <Heart
              size={18}
              className={likedPhotos.has(photo.id) ? 'fill-red-500 text-red-500' : 'text-white'}
              style={{
                fill: likedPhotos.has(photo.id) ? '#ef4444' : 'none',
                animation: likeMutation.isLoading ? 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite' : 'none'
              }}
            />
          </motion.button>
        </div>

        {/* Report Button - Bottom Left */}
        <div className="absolute bottom-4 left-4 pointer-events-auto">
          <motion.button
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleReport(photo.id)}
            disabled={reportMutation.isLoading}
            className="flex items-center space-x-1  text-white hover:text-orange-400 transition-colors disabled:opacity-50"
          >
            <Flag
              size={18}
              className={`${reportMutation.isLoading ? 'animate-pulse' : ''}`}
              fill="none"
            />
          </motion.button>
        </div>
      </div>
    </motion.div>
  )
}

export default PhotoCard