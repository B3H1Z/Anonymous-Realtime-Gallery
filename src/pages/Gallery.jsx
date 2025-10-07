import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Heart, MessageCircle, Share2, Filter, Flag, Clock, Shield, ArrowUp } from 'lucide-react'
import toast from 'react-hot-toast'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import ReportModal from '../components/ReportModal'
import PhotoCard from '../components/PhotoCard'
import { useImageFilter } from '../hooks/useImageFilter'

const Gallery = () => {
  const [filter, setFilter] = useState('recent')
  const [searchTerm, setSearchTerm] = useState('')
  const [likedPhotos, setLikedPhotos] = useState(new Set())
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [pendingLikePhotoId, setPendingLikePhotoId] = useState(null)
  const [pendingReportPhotoId, setPendingReportPhotoId] = useState(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [captchaAction, setCaptchaAction] = useState(null) // 'like' or 'report'
  const [captchaToken, setCaptchaToken] = useState(null)
  const [page, setPage] = useState(0)
  const [allPhotos, setAllPhotos] = useState([])
  const [hasMorePhotos, setHasMorePhotos] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [showScrollTop, setShowScrollTop] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false) // Track initial load
  const [triggerUpload, setTriggerUpload] = useState(false) // Trigger upload modal
  const captchaRef = useRef(null)
  const queryClient = useQueryClient()
  const observerTarget = useRef(null)
  const isLoadingRef = useRef(false) // Immediate lock to prevent race conditions

  // Load liked photos from localStorage on component mount
  useEffect(() => {
    const savedLikedPhotos = localStorage.getItem('pabede_liked_photos')
    if (savedLikedPhotos) {
      try {
        const likedArray = JSON.parse(savedLikedPhotos)
        const likedSet = new Set(likedArray)
        setLikedPhotos(likedSet)
      } catch (error) {
      }
    }
  }, [])

  // Save liked photos to localStorage whenever it changes
  useEffect(() => {
    if (likedPhotos.size > 0) {
      localStorage.setItem('pabede_liked_photos', JSON.stringify([...likedPhotos]))
    } else {
      localStorage.removeItem('pabede_liked_photos')
    }
  }, [likedPhotos])

  // Reset pagination when filter changes
  useEffect(() => {
    setPage(0)
    setAllPhotos([])
    setHasMorePhotos(true)
    setInitialLoadComplete(false) // Reset on filter change
  }, [filter])

  // Fetch initial photos from API
  const { data: photosData, isLoading, error, isFetching } = useQuery({
    queryKey: ['photos', filter],
    queryFn: async () => {
      const response = await fetch(`/api/photos?page=0&sort=${filter}`)
      if (!response.ok) {
        throw new Error('Failed to fetch photos')
      }
      return response.json()
    },
    staleTime: 5 * 60 * 1000,
  })

  // Update allPhotos when initial data loads
  useEffect(() => {
    if (photosData?.photos) {
      setAllPhotos(photosData.photos)
      setHasMorePhotos(photosData.hasMore)
      setPage(0)
      setInitialLoadComplete(true) // Mark initial load as complete
    }
  }, [photosData])

  // Memoize the photos array to prevent unnecessary re-renders
  const photosToFilter = useMemo(() => {
    return page === 0 ? allPhotos : []
  }, [page, allPhotos])

  // Filter out photos with missing images (only filter initial load, not during pagination)
  const { filteredPhotos: photos, isFiltering, updatePhoto } = useImageFilter(photosToFilter)

  // For pages > 0, append to photos directly without filtering
  const displayPhotos = page === 0 ? photos : allPhotos

  // Simple infinite scroll with Intersection Observer
  useEffect(() => {
    if (!observerTarget.current) {
      return
    }
    
    // Don't observe while loading initial data
    if (isLoading) {
      return
    }

    const observer = new IntersectionObserver(
      async (entries) => {
        
        // Immediate guard with ref to prevent race conditions
        if (entries[0].isIntersecting && hasMorePhotos && !isLoadingMore && !isLoadingRef.current) {
          
          // Set both state and ref immediately
          isLoadingRef.current = true
          setIsLoadingMore(true)
          
          try {
            const nextPage = page + 1
            const response = await fetch(`/api/photos?page=${nextPage}&sort=${filter}`)
            
            if (response.ok) {
              const data = await response.json()
              setAllPhotos(prev => [...prev, ...data.photos])
              setHasMorePhotos(data.hasMore)
              setPage(nextPage)
            } else {
            }
          } catch (error) {
            toast.error('Error loading more photos', {
              icon: '⚠️',
              position: 'top-left'
            })
          } finally {
            // Add a small delay before allowing next load
            setTimeout(() => {
              isLoadingRef.current = false
              setIsLoadingMore(false)
            }, 500)
          }
        }
      },
      { threshold: 0.1, rootMargin: '200px' }
    )

    observer.observe(observerTarget.current)
    return () => observer.disconnect()
  }, [page, filter, hasMorePhotos, isLoadingMore, isLoading])

  // Show/hide scroll to top button based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollY = window.scrollY || document.documentElement.scrollTop
      setShowScrollTop(scrollY > 500) // Show button after scrolling down 500px
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to top function
  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    })
  }

  // Like mutation
  const likeMutation = useMutation({
    mutationFn: async ({ photoId, token }) => {
      const response = await fetch(`/api/photos/${photoId}/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ captchaToken: token }),
      })
      if (!response.ok) {
        throw new Error('Failed to like photo')
      }
      return response.json()
    },
    onSuccess: (data, { photoId }) => {
      // Handle toggle behavior based on server response
      if (data.action === 'liked') {
        // Mark photo as liked
        setLikedPhotos(prev => new Set([...prev, photoId]))
        // Update like count in both allPhotos and filtered photos
        setAllPhotos(prev => 
          prev.map(photo => 
            photo.id === photoId ? { ...photo, likes: data.likes } : photo
          )
        )
        updatePhoto(photoId, { likes: data.likes })
        toast.success('You liked this photo!', {
          icon: <Heart size={20} fill="#ef4444" className="text-red-500" />,
          position: 'top-left',
          duration: 3000,
          style: {
            background: 'rgba(31, 41, 55, 0.8)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
          }
        })
      } else if (data.action === 'unliked') {
        // Remove photo from liked set
        setLikedPhotos(prev => {
          const newSet = new Set(prev)
          newSet.delete(photoId)
          return newSet
        })
        // Update like count in both allPhotos and filtered photos
        setAllPhotos(prev => 
          prev.map(photo => 
            photo.id === photoId ? { ...photo, likes: data.likes } : photo
          )
        )
        updatePhoto(photoId, { likes: data.likes })
        toast.success('Like removed!', {
          icon: <Heart size={20} className="text-gray-500" />,
          position: 'top-left',
          duration: 2000,
        })
      }

      // Reset captcha state
      setCaptchaToken(null)
      setShowCaptcha(false)
      setPendingLikePhotoId(null)
    },
    onError: (error, { photoId }) => {
      toast.error('Error liking photo', {
        icon: '❌',
        position: 'top-left'
      })
      // Reset captcha state on error
      setCaptchaToken(null)
      setShowCaptcha(false)
      setPendingLikePhotoId(null)
    }
  })

  // Report mutation
  const reportMutation = useMutation({
    mutationFn: async ({ photoId, token, reason }) => {
      const response = await fetch(`/api/photos/${photoId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ captchaToken: token, reason }),
      })

      const data = await response.json()

      // Handle duplicate report gracefully (409 status)
      if (response.status === 409 && data.alreadyReported) {
        return {
          alreadyReported: true,
          message: data.error || 'You have already reported this photo'
        }
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to report photo')
      }

      return data
    },
    onSuccess: (data) => {
      if (data.alreadyReported) {
        toast('You have already reported this photo!', {
          position: 'top-left',
          style: {
            background: '#374151',
            color: '#9ca3af',
            border: '1px solid #4b5563',
          },
          duration: 3000
        })
      } else {
        toast.success('Photo reported successfully', {
          icon: '🚩',
          position: 'top-left'
        })
      }
      // Reset all modal states
      setCaptchaToken(null)
      setShowCaptcha(false)
      setPendingReportPhotoId(null)
      setCaptchaAction(null)
      setShowReportModal(false)
      // Clear sessionStorage
      sessionStorage.removeItem('reportReason')
    },
    onError: (error) => {
      if (error.message.includes('already reported') || error.message.includes('409')) {
        toast('You have already reported this photo!', {
          position: 'top-left',
          style: {
            background: '#374151',
            color: '#9ca3af',
            border: '1px solid #4b5563',
          },
          duration: 3000
        })
      } else {
        toast.error('   ', {
          icon: '❌',
          position: 'top-left'
        })
      }
      // Reset all modal states on error
      setCaptchaToken(null)
      setShowCaptcha(false)
      setPendingReportPhotoId(null)
      setCaptchaAction(null)
      setShowReportModal(false)
      // Clear sessionStorage
      sessionStorage.removeItem('reportReason')
    }
  })

  const handleLike = (photoId) => {
    // Toggle behavior: if already liked, unlike it; otherwise, like it
    // Both actions now require CAPTCHA verification
    setPendingLikePhotoId(photoId)
    setCaptchaAction('like')
    setShowCaptcha(true)
  }

  const handleCaptchaVerify = (token) => {
    setCaptchaToken(token)
    // Automatically submit based on action
    if (captchaAction === 'like' && pendingLikePhotoId && token) {
      likeMutation.mutate({ photoId: pendingLikePhotoId, token })
    } else if (captchaAction === 'report' && pendingReportPhotoId && token) {
      const reason = sessionStorage.getItem('reportReason') || 'user_reported'
      reportMutation.mutate({ photoId: pendingReportPhotoId, token, reason })
    }
  }

  const handleCaptchaExpire = () => {
    setCaptchaToken(null)
  }

    const handleCaptchaError = (err) => {
    toast.error('Captcha verification failed', {
      icon: '🔒',
      position: 'top-left'
    })
    setShowCaptcha(false)
    setPendingLikePhotoId(null)
    setPendingReportPhotoId(null)
    setCaptchaAction(null)
    setShowReportModal(false)
    // Clear sessionStorage
    sessionStorage.removeItem('reportReason')
  }

    const closeCaptchaModal = () => {
    setShowCaptcha(false)
    setPendingLikePhotoId(null)
    setPendingReportPhotoId(null)
    setCaptchaAction(null)
    setCaptchaToken(null)
    // Clear sessionStorage
    sessionStorage.removeItem('reportReason')
    // Reset captcha
    if (captchaRef.current) {
      captchaRef.current.resetCaptcha()
    }
  }

  const handleReport = (photoId) => {
    // Show report modal
    setPendingReportPhotoId(photoId)
    setShowReportModal(true)
  }

  const handleReportWithReason = (photoId, reason) => {
    // Show captcha modal for report with reason
    setPendingReportPhotoId(photoId)
    setCaptchaAction('report')
    setShowCaptcha(true)
    // Store the reason for later use
    sessionStorage.setItem('reportReason', reason)
  }

  const handleUploadClick = () => {
    // Dispatch custom event to trigger upload modal in FloatingActions
    window.dispatchEvent(new CustomEvent('openUploadModal'))
  }

  const filters = [
    { id: 'liked', label: ' ', icon: Heart },
    { id: 'recent', label: '', icon: Clock },
  ]

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.03,
        delayChildren: 0.05
      }
    }
  }

  const itemVariants = {
    hidden: { 
      opacity: 0, 
      y: 20,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        type: "spring",
        stiffness: 400,
        damping: 30,
        mass: 0.8
      }
    },
    exit: {
      opacity: 0,
      y: -20,
      scale: 0.95,
      transition: {
        duration: 0.15,
        ease: "easeOut"
      }
    }
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">😵</div>
          <h2 className="text-2xl font-bold text-white mb-2">Something went wrong!</h2>
          <p className="text-gray-400">There was a problem loading photos. Please try again.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-12 w-full overflow-x-hidden">
      {/* Report Modal */}
      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        onReport={handleReportWithReason}
        photoId={pendingReportPhotoId}
        isLoading={reportMutation.isLoading}
      />
      {/* Fixed Floating Hero Section */}
      <motion.section
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        className="fixed top-0 left-0 right-0 z-40 text-center py-6 px-6 glassmorphism-dark border-b border-white/10 backdrop-blur-lg"
      >
        <div className="max-w-4xl mx-auto">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-lg md:text-2xl font-bold mb-3"
          >
            <span className="bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent whitespace-nowrap">
              Share Your Moments 📸
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-base text-gray-300 mb-0 max-w-2xl mx-auto"
          >
            Browse and share anonymous photos with the community.
          </motion.p>
        </div>
      </motion.section>

      {/* Scroll to Top Button - Above Filter Buttons */}
      <div className="fixed bottom-[115px] z-30 flex flex-col items-center" style={{ left: '1.5rem' }}>
        <motion.button
          whileHover={{ scale: 1.1, rotate: 5 }}
          whileTap={{ scale: 0.9 }}
          onClick={scrollToTop}
          className="group relative w-14 h-14 rounded-2xl transition-all duration-300 flex items-center justify-center glassmorphism text-gray-300 hover:text-white hover:bg-white/10 shadow-2xl"
        >
          <ArrowUp size={24} />
          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg bg-white/20" />
        </motion.button>
        <span className="text-[10px] text-white font-medium mt-1 whitespace-nowrap px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm shadow-lg border border-white/10">Scroll Top</span>
      </div>

      {/* Floating Filter Buttons - Horizontal Layout */}
      <div className="fixed bottom-6 z-30 flex flex-row space-x-3 " style={{ left: '1.5rem' }}>
        {filters.map((f) => (
          <div key={f.id} className="flex flex-col items-center">
            <motion.button
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                if (filter !== f.id) {
                  setFilter(f.id)
                }
              }}
              className={`group relative w-14 h-14 rounded-2xl transition-all duration-300 flex items-center justify-center text-xl ${
                filter === f.id
                  ? 'glassmorphism bg-gradient-to-r text-white shadow-[0_0_30px_rgba(255,255,255,0.6),0_0_60px_rgba(255,255,255,0.4)]'
                  : 'glassmorphism text-gray-300 hover:text-white hover:bg-white/10 shadow-2xl'
              }`}
            >
              <f.icon size={24} />
              <div className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg ${
                filter === f.id
                  ? 'bg-gradient-to-r from-white to-gray-300'
                  : 'bg-white/20'
              }`} />
            </motion.button>
            <span className="text-[10px] text-white font-medium mt-1 whitespace-nowrap px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-sm shadow-lg border border-white/10">
              {f.id === 'liked' ? 'Most Liked' : 'Recent'}
            </span>
          </div>
        ))}
      </div>

      {/* Photo Gallery */}
      <div className="px-4 sm:px-6 pt-32 w-full">
        <div className="max-w-7xl mx-auto w-full">
          {isLoading || isFiltering ? (
            // Initial loading state
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center py-20"
            >
              <div className="w-8 h-8 border-3 border-gray-600 border-t-pink-500 rounded-full animate-spin" />
            </motion.div>
          ) : isFetching || isFiltering ? (
            // Filter switching transition state
            <motion.div
              key={`fetching-${filter}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center py-20"
            >
              <motion.div
                animate={{ 
                  rotate: [0, 360],
                  scale: [1, 1.2, 1]
                }}
                transition={{ 
                  rotate: { duration: 1, repeat: Infinity, ease: "linear" },
                  scale: { duration: 0.5, repeat: Infinity, ease: "easeInOut" }
                }}
                className="text-4xl mb-4 inline-block"
              >
                🔄
              </motion.div>
              <motion.h3
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="text-xl font-bold text-white mb-2"
              >
                Loading photos...
              </motion.h3>
              <p className="text-gray-400">Getting {filter === 'liked' ? 'most liked' : 'recent'} photos</p>
            </motion.div>
          ) : displayPhotos?.length > 0 ? (
            <motion.div
              key={filter} // Re-mount container when filter changes
              variants={initialLoadComplete ? {} : containerVariants} // Only animate initial load
              initial={initialLoadComplete ? false : "hidden"}
              animate={initialLoadComplete ? false : "visible"}
              className="gallery-grid grid gap-6 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              style={{ 
                transform: 'translateZ(0)',
                backfaceVisibility: 'hidden'
              }}
            >
              <AnimatePresence mode="popLayout">
                {displayPhotos.map((photo, index) => (
                  <PhotoCard
                    key={`${photo.id}`}
                    photo={photo}
                    index={index}
                    filter={filter}
                    likedPhotos={likedPhotos}
                    handleLike={handleLike}
                    handleReport={handleReport}
                    likeMutation={likeMutation}
                    reportMutation={reportMutation}
                    itemVariants={initialLoadComplete ? {} : itemVariants} // Only animate initial load
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center py-24"
            >
              <div className="relative">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-9xl mb-8"
                >
                  📸
                </motion.div>
              </div>
              <h3 className="text-3xl font-bold text-white mb-6">No photos yet!</h3>
              <p className="text-gray-400 mb-10 max-w-lg mx-auto text-lg leading-relaxed">
                Be the first to share your photo!
              </p>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleUploadClick}
                className="bg-gradient-to-r from-pink-500 via-rose-500 to-yellow-500 text-white px-10 py-4 rounded-2xl font-bold text-lg shadow-2xl hover:shadow-pink-500/50 transition-all duration-500"
              >
                <span className="flex items-center">
                  <span className="mr-3 text-xl">🚀</span>
                  Share Now!
                </span>
              </motion.button>
            </motion.div>
          )}

        </div>
      </div>

      {/* Captcha Modal */}
      <AnimatePresence>
        {showCaptcha && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
            onClick={closeCaptchaModal}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-900/95 backdrop-blur-lg rounded-2xl p-8 max-w-md w-full mx-4 border border-gray-700/50"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="flex justify-center mb-4">
                  <div className={`p-3 rounded-full ${
                    captchaAction === 'like' ? 'bg-red-500/20' : 'bg-orange-500/20'
                  }`}>
                    <Shield size={32} className={
                      captchaAction === 'like' ? 'text-red-400' : 'text-orange-400'
                    } />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Verification</h3>
                <p className="text-gray-300 text-sm">
                  {captchaAction === 'like' 
                    ? 'Please verify you\'re not a robot to like this photo'
                    : 'Please verify you\'re not a robot to report this photo'
                  }
                </p>
              </div>

              <div className="flex justify-center mb-6" >
                <HCaptcha
                  ref={captchaRef}
                  sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001"} // Test key for development
                  onVerify={handleCaptchaVerify}
                  onExpire={handleCaptchaExpire}
                  onError={handleCaptchaError}
                  theme="dark"
                  size="normal"
                  hl="en"
                />
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (captchaToken) {
                      if (captchaAction === 'like' && pendingLikePhotoId) {
                        likeMutation.mutate({ photoId: pendingLikePhotoId, token: captchaToken })
                      } else if (captchaAction === 'report' && pendingReportPhotoId) {
                        reportMutation.mutate({ photoId: pendingReportPhotoId, token: captchaToken })
                      }
                    }
                  }}
                  disabled={!captchaToken || likeMutation.isLoading || reportMutation.isLoading}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(likeMutation.isLoading || reportMutation.isLoading) ? 'Verifying...' : 
                   captchaAction === 'like' ? 'Confirm Like' : 'Confirm Report'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={closeCaptchaModal}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-3 px-4 rounded-xl font-medium transition-colors"
                >
                  Cancel
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Infinite scroll trigger - Always rendered so observer can attach */}
      <div 
        ref={observerTarget} 
        className="h-20 flex items-center justify-center"
        style={{ minHeight: '20px' }}
      >
        {isLoadingMore && hasMorePhotos && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center space-x-3 "
          >
            <div className="w-5 h-5 border-2 border-gray-600 border-t-pink-500 rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">Loading more photos...</p>
          </motion.div>
        )}
      </div>

      {/* End of content message when no more photos */}
      {!hasMorePhotos && allPhotos.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-12"
        >
          <div className="text-4xl mb-4">🎉</div>
          <h3 className="text-xl font-bold text-white mb-2">You've seen it all!</h3>
          <p className="text-gray-400">No more photos to show. Check back later for new content :)</p>
        </motion.div>
      )}
    </div>
  )
}

export default Gallery