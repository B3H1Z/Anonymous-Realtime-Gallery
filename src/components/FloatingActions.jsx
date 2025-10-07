import React, { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Camera, X, CheckCircle, AlertCircle, RotateCcw, Upload } from 'lucide-react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import Webcam from 'react-webcam'
import toast from 'react-hot-toast'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import { 
  trackModalOpen, 
  trackModalClose, 
  trackCameraStart, 
  trackPhotoCapture, 
  trackPhotoRetake, 
  trackPhotoUpload,
  trackPolicyView
} from '../utils/analytics'

// Custom hook for typing effect with infinite loop
const useTypingEffect = (text, speed = 100, pauseTime = 2000) => {
  const [displayedText, setDisplayedText] = useState('')
  const [isComplete, setIsComplete] = useState(false)

  React.useEffect(() => {
    if (!text) return
    
    // Split text into an array of characters (including emojis properly)
    const characters = Array.from(text)
    let currentIndex = 0
    let isTyping = true
    setDisplayedText('')
    setIsComplete(false)
    
    const interval = setInterval(() => {
      if (isTyping) {
        if (currentIndex < characters.length) {
          setDisplayedText(characters.slice(0, currentIndex + 1).join(''))
          currentIndex++
        } else {
          setIsComplete(true)
          isTyping = false
          // Wait before restarting
          setTimeout(() => {
            currentIndex = 0
            setDisplayedText('')
            setIsComplete(false)
            isTyping = true
          }, pauseTime)
        }
      }
    }, speed)

    return () => clearInterval(interval)
  }, [text, speed, pauseTime])

  return { displayedText, isComplete }
}

const FloatingActions = () => {
  const [showUploadPrompt, setShowUploadPrompt] = useState(true)
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false)
  const [isCameraActive, setIsCameraActive] = useState(false)
  const [isCameraReady, setIsCameraReady] = useState(false)
  const [capturedImage, setCapturedImage] = useState(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showCaptcha, setShowCaptcha] = useState(false)
  const [captchaToken, setCaptchaToken] = useState(null)
  const [showPolicyModal, setShowPolicyModal] = useState(false)
  const webcamRef = useRef(null)
  const canvasRef = useRef(null)
  const captchaRef = useRef(null)
  const lastErrorRef = useRef(null) // Prevent duplicate error toasts
  const queryClient = useQueryClient()
  
  // Typing effect for button text (10 second pause)
  const { displayedText, isComplete } = useTypingEffect('Upload Photo! 📸', 150, 10000)

  // Auto-hide upload prompt after 10 seconds
  React.useEffect(() => {
    const timer = setTimeout(() => setShowUploadPrompt(false), 10000)
    return () => clearTimeout(timer)
  }, [])

  // Listen for custom event to open upload modal
  React.useEffect(() => {
    const handleOpenUpload = () => {
      setIsUploadModalOpen(true)
    }
    
    window.addEventListener('openUploadModal', handleOpenUpload)
    return () => window.removeEventListener('openUploadModal', handleOpenUpload)
  }, [])

  const uploadMutation = useMutation({
    mutationFn: async ({ imageFile, captchaToken }) => {
      const formData = new FormData()
      formData.append('image', imageFile)
      formData.append('captchaToken', String(captchaToken))

      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100
            setUploadProgress(percentComplete)
          }
        })

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            reject(new Error('Upload failed'))
          }
        })

        xhr.addEventListener('error', () => {
          reject(new Error('Upload failed'))
        })

        xhr.open('POST', '/api/photos/upload')
        xhr.send(formData)
      })
    },
    onSuccess: () => {
      toast.success(
        <div>
          <div>Photo uploaded successfully</div>
          <div style={{ fontSize: '0.75rem', marginTop: '0.25rem', opacity: 0.9 }}>
            Will be published after admin approval
          </div>
        </div>,
        {
          icon: '✅',
          position: 'top-left',
          style: {
            background: '#10b981',
            color: '#fff',
            border: '1px solid #059669',
          }
        }
      )
      trackPhotoUpload(true)
      setCapturedImage(null)
      setIsCameraActive(false)
      setIsUploadModalOpen(false)
      setUploadProgress(0)
      setCaptchaToken(null)
      setShowCaptcha(false)
      stopCamera()
    },
    onError: (error) => {
      toast.error('Photo upload failed, please try again!', {
        icon: '❌',
        position: 'top-left'
      })
      trackPhotoUpload(false)
      setUploadProgress(0)
      setCaptchaToken(null)
      setShowCaptcha(false)
    },
  })

  // Camera functions
  const startCamera = useCallback(() => {
    setIsCameraActive(true)
    setIsCameraReady(false)
    trackCameraStart()
  }, [])

  const stopCamera = useCallback(() => {
    setIsCameraActive(false)
    setIsCameraReady(false)
  }, [])

  const capturePhoto = useCallback(() => {
    if (webcamRef.current && webcamRef.current.video) {
      const video = webcamRef.current.video
      const canvas = canvasRef.current

      if (canvas && video.videoWidth && video.videoHeight) {
        const videoWidth = video.videoWidth
        const videoHeight = video.videoHeight
        
        // Target portrait aspect ratio (9:16)
        const targetAspectRatio = 9 / 16
        
        // Calculate dimensions to maintain portrait aspect ratio
        let sourceX = 0
        let sourceY = 0
        let sourceWidth = videoWidth
        let sourceHeight = videoHeight
        
        const videoAspectRatio = videoWidth / videoHeight
        
        if (videoAspectRatio > targetAspectRatio) {
          // Video is wider than target (landscape), crop horizontally to portrait
          sourceWidth = videoHeight * targetAspectRatio
          sourceX = (videoWidth - sourceWidth) / 2
        } else if (videoAspectRatio < targetAspectRatio) {
          // Video is taller than target, crop vertically
          sourceHeight = videoWidth / targetAspectRatio
          sourceY = (videoHeight - sourceHeight) / 2
        }
        
        // Use maximum available resolution from video feed, capped at 1440x2560 for ultra quality
        const maxWidth = 1440
        const maxHeight = 2560
        
        // Calculate the best output dimensions while maintaining 9:16 ratio
        let outputWidth = Math.min(sourceWidth, maxWidth)
        let outputHeight = Math.min(sourceHeight, maxHeight)
        
        // Ensure we maintain the 9:16 aspect ratio
        if (outputWidth / outputHeight > targetAspectRatio) {
          outputWidth = outputHeight * targetAspectRatio
        } else {
          outputHeight = outputWidth / targetAspectRatio
        }
        
        // Set canvas to ultra high quality portrait dimensions
        canvas.width = Math.round(outputWidth)
        canvas.height = Math.round(outputHeight)

        const ctx = canvas.getContext('2d')
        
        // Enable image smoothing for better quality
        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        
        // Draw the cropped and scaled image
        ctx.drawImage(
          video,
          sourceX, sourceY, sourceWidth, sourceHeight,  // Source crop
          0, 0, canvas.width, canvas.height              // Destination size
        )

        // Convert to maximum quality JPEG (0.98 = 98% quality)
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
            setCapturedImage(file)
            stopCamera()
            trackPhotoCapture()
          }
        }, 'image/jpeg', 0.98) // Maximum quality JPEG (98%)
      } else {
        // Fallback to getScreenshot if canvas method fails
        const imageSrc = webcamRef.current.getScreenshot({ quality: 0.98 })
        if (imageSrc) {
          fetch(imageSrc)
            .then(res => res.blob())
            .then(blob => {
              const file = new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' })
              setCapturedImage(file)
              stopCamera()
              trackPhotoCapture()
            })
        }
      }
    }
  }, [stopCamera])

  const retakePhoto = useCallback(() => {
    setCapturedImage(null)
    setCaptchaToken(null)
    setShowCaptcha(false)
    startCamera()
    trackPhotoRetake()
  }, [startCamera])

  const handleUpload = async () => {
    if (!capturedImage) return
    // Show captcha modal for upload
    setShowCaptcha(true)
    trackModalOpen('captcha_upload_modal')
  }

  const closeModal = useCallback(() => {
    setIsUploadModalOpen(false)
    setIsCameraActive(false)
    setCapturedImage(null)
    setUploadProgress(0)
    setCaptchaToken(null)
    setShowCaptcha(false)
    setShowPolicyModal(false)
    stopCamera()
    trackModalClose('upload_modal')
  }, [stopCamera])

  // Captcha handlers
    const handleCaptchaVerify = (token) => {
    setCaptchaToken(token)
    // Don't auto-upload - wait for user to click upload button
  }

  const handleCaptchaExpire = () => {
    setCaptchaToken(null)
  }

  const handleCaptchaError = (err) => {
    toast.error('Error verifying captcha', {
      icon: '🔒',
      position: 'top-left'
    })
    setShowCaptcha(false)
    setCaptchaToken(null)
  }

  const closeCaptchaModal = () => {
    setShowCaptcha(false)
    setCaptchaToken(null)
    // Reset captcha
    if (captchaRef.current) {
      captchaRef.current.resetCaptcha()
    }
  }

  return (
    <>
      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 right-6 z-40 flex flex-col items-end space-y-2">
        {/* Upload Button with Label */}
        <div className="flex flex-col items-center space-y-2">
          <motion.button
            whileHover={{ scale: 1.1, rotate: 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => setIsUploadModalOpen(true)}
            className="group relative w-16 h-16 glassmorphism-dark rounded-full shadow-2xl hover:bg-white/20 transition-all duration-500 flex items-center justify-center text-2xl border border-white/10 hover:border-white/20"
          >
            <motion.span
              animate={{ rotate: [0, 10, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="group-hover:rotate-12 transition-transform duration-300"
            >
              <Upload />
            </motion.span>
            <div className="absolute inset-0 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg bg-white/30" />
          </motion.button>
          <span className="text-xs text-white/80 font-medium bg-black/50 px-2 py-1 rounded-full backdrop-blur-sm inline-block min-w-[105px] text-center">
            {displayedText}
            {!isComplete && <span className="animate-pulse">|</span>}
          </span>
        </div>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {isUploadModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={() => setIsUploadModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto glassmorphism rounded-2xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                    Your Turn to Share!
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Don't hesitate, share your photo now!...
                  </p>
                </div>
                <button
                  onClick={closeModal}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Modal Content */}
              <div className="p-6">
                {/* Camera/Captured Image Area */}
                <div className="relative border-2 border-dashed rounded-2xl p-4 text-center transition-all duration-300 mb-6 min-h-[300px] flex items-center justify-center">
                  {!isCameraActive && !capturedImage && (
                    <motion.div
                      className="flex flex-col items-center"
                    >
                      <motion.div
                        className="w-16 h-16 bg-gradient-to-br from-pink-400 to-rose-400 rounded-2xl flex items-center justify-center text-2xl mb-4 shadow-lg"
                      >
                        <Camera />
                      </motion.div>
                      <h3 className="text-xl font-semibold text-white mb-2">
                        Ready to Take a Photo?
                      </h3>
                      <p className="text-gray-400 mb-4">
                        Open the camera and take your photo!
                      </p>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={startCamera}
                        className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                      >
                        Let's Go!
                      </motion.button>
                    </motion.div>
                  )}

                  {isCameraActive && !capturedImage && (
                    <div className="relative w-full flex justify-center">
                      <div className="relative max-w-[400px] max-h-[90vh] w-full">
                        {/* Loading spinner while camera initializes */}
                        {!isCameraReady && (
                          <div className="absolute inset-0 flex items-center justify-center bg-gray-900 rounded-xl z-20">
                            <div className="flex flex-col items-center">
                              <div className="w-12 h-12 border-4 border-pink-500/30 border-t-pink-500 rounded-full animate-spin mb-3"></div>
                              <p className="text-gray-400 text-sm">Loading camera...</p>
                            </div>
                          </div>
                        )}
                        <Webcam
                          ref={webcamRef}
                          audio={false}
                          screenshotFormat="image/jpeg"
                          screenshotQuality={0.98}
                          videoConstraints={{
                            width: { min: 1080, ideal: 1920, max: 3840 },
                            height: { min: 1920, ideal: 3840, max: 4096 },
                            aspectRatio: { ideal: 0.5625 }, // 9:16 as decimal (9/16 = 0.5625)
                            facingMode: 'environment', // Prefer back camera, fallback to front if unavailable
                            frameRate: { ideal: 30, max: 60 }
                          }}
                          className={`rounded-xl shadow-lg w-full h-full transition-opacity duration-300 ${isCameraReady ? 'opacity-100' : 'opacity-0'}`}
                          style={{
                            maxWidth: '400px',
                            maxHeight: '90vh',
                            aspectRatio: '9/16', // Portrait mode
                            objectFit: 'cover', // Cover the area to maintain aspect ratio
                            width: '100%',
                            height: 'auto'
                          }}
                          onUserMedia={() => {
                            // Camera stream started, wait a bit for orientation to settle
                            setTimeout(() => {
                              setIsCameraReady(true)
                            }, 300)
                          }}
                          onUserMediaError={(error) => {
                            let errorMessage = 'Camera access is not available'

                            if (error.name === 'NotAllowedError') {
                              errorMessage = 'Please allow camera access or check browser settings'
                            } else if (error.name === 'NotFoundError') {
                              errorMessage = 'No camera found on this device'
                            } else if (error.name === 'NotReadableError') {
                              errorMessage = 'Camera is being used by another application'
                            } else if (error.name === 'OverconstrainedError') {
                              errorMessage = 'Camera quality requirements not met'
                            }

                            // Prevent duplicate toast notifications
                            const errorKey = `${error.name}-${errorMessage}`
                            if (lastErrorRef.current !== errorKey) {
                              lastErrorRef.current = errorKey
                              toast.error(errorMessage)
                              
                              // Reset error ref after 2 seconds to allow showing same error again later
                              setTimeout(() => {
                                lastErrorRef.current = null
                              }, 2000)
                            }

                            setIsCameraActive(false)
                            setIsCameraReady(false)
                          }}
                        />
                      </div>
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-4">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={capturePhoto}
                          disabled={!isCameraReady}
                          className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-lg z-10 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <div className="w-12 h-12 bg-red-500 rounded-full"></div>
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => {
                            stopCamera()
                            closeModal()
                          }}
                          className="w-12 h-12 bg-gray-600 rounded-full flex items-center justify-center z-10"
                        >
                          <X size={20} className="text-white" />
                        </motion.button>
                      </div>
                    </div>
                  )}

                  {capturedImage && (
                    <div className="relative w-full flex justify-center">
                      <div className="relative max-w-[400px] max-h-[90vh] w-full">
                        <img
                          src={URL.createObjectURL(capturedImage)}
                          alt="Captured"
                          className="rounded-xl shadow-lg w-full h-full"
                          style={{
                            maxWidth: '400px',
                            maxHeight: '90vh',
                            aspectRatio: '9/16',
                            objectFit: 'cover',
                            width: '100%',
                            height: 'auto'
                          }}
                        />
                      </div>
                      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-3 gap-3">
                        <motion.button
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={handleUpload}
                          disabled={uploadMutation.isPending}
                          className="group relative bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white px-8 py-3 rounded-2xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-lg hover:shadow-xl border border-pink-400/30 hover:border-pink-300/50"
                        >
                          <span className="flex items-center space-x-2 ">
                            {uploadMutation.isPending ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                <span>Uploading...</span>
                              </>
                            ) : (
                              <>
                                <Upload size={18} />
                                <span>Upload</span>
                              </>
                            )}
                          </span>
                          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg bg-pink-500/30" />
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.05, y: -2 }}
                          whileTap={{ scale: 0.95 }}
                          onClick={retakePhoto}
                          className="group relative bg-white/10 backdrop-blur-md text-white px-6 py-3 rounded-2xl font-semibold flex items-center space-x-2  border border-white/20 hover:bg-white/20 hover:border-white/30 transition-all duration-300 shadow-lg hover:shadow-xl"
                        >
                          <RotateCcw size={18} className="group-hover:rotate-12 transition-transform duration-300" />
                          <span>Retake</span>
                          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-lg bg-white/20" />
                        </motion.button>
                      </div>
                      {uploadMutation.isPending && (
                        <div className="mt-4 w-full">
                          <div className="bg-gray-700 rounded-full h-2">
                            <motion.div
                              className="bg-gradient-to-r from-pink-500 to-rose-500 h-2 rounded-full"
                              initial={{ width: 0 }}
                              animate={{ width: `${uploadProgress}%` }}
                              transition={{ duration: 0.3 }}
                            />
                          </div>
                          <p className="text-center text-sm text-gray-400 mt-2">
                            {Math.round(uploadProgress)}% Uploaded
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Hidden canvas for image processing */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Guidelines */}
                <div className="mt-6 pt-6 border-t border-gray-700/50">
                  <h4 className="font-medium text-white mb-3 flex items-center">
                    <AlertCircle className="mr-2   text-purple-400" size={16} />
                    Basic Rules!
                  </h4>
                  <div className="grid md:grid-cols-2 gap-4 text-sm text-gray-300">
                    <div>
                      <h5 className="font-medium text-white mb-2">✅ Great if you...</h5>
                      <ul className="space-y-1 text-xs">
                        <li>• Share your creative photo</li>
                        <li>• Be creative</li>
                        <li>• Make others smile</li>
                        <li>• Keep it appropriate</li>
                        <li>• Maintain good taste</li>
                      </ul>
                    </div>
                    <div>
                      <h5 className="font-medium text-white mb-2">❌ Please don't...</h5>
                      <ul className="space-y-1 text-xs">
                        <li>• Share others' photos without permission</li>
                        <li>• Don't upload inappropriate content</li>
                        <li>• Reveal personal information</li>
                        <li>• Post spam</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
                  <div className="p-3 rounded-full bg-blue-500/20">
                    <Upload size={32} className="text-blue-400" />
                  </div>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Verification</h3>
                <p className="text-gray-300 text-sm">
                  Please verify you're not a robot
                </p>
              </div>

              {/* Captcha */}
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

              {/* Policy Acceptance Notice */}
              <div className="mb-6">
                <div className="bg-gray-800/50 border border-gray-600/30 rounded-lg p-4">
                  <p className="text-sm text-gray-200 leading-relaxed text-center">
                    By submitting, you confirm that you have read and accepted our{' '}
                    <button
                      onClick={() => {
                        setShowPolicyModal(true)
                        setShowCaptcha(false)
                        trackPolicyView()
                      }}
                      className="text-pink-400 hover:text-pink-300 underline font-medium transition-colors"
                    >
                      Terms of Service
                    </button>
                    {' '}.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    if (captchaToken && capturedImage) {
                      uploadMutation.mutate({ imageFile: capturedImage, captchaToken })
                    }
                  }}
                  disabled={!captchaToken || uploadMutation.isPending}
                  className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white py-3 px-4 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadMutation.isPending ? 'Uploading...' : 'Verify & Upload'}
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

      {/* Policy Modal */}
      <AnimatePresence>
        {showPolicyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setShowPolicyModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto glassmorphism rounded-2xl shadow-2xl border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-700/50">
                <div>
                  <h2 className="text-2xl font-bold bg-gradient-to-r from-pink-400 to-rose-400 bg-clip-text text-transparent">
                    Comprehensive Terms of Service
                  </h2>
                  <p className="text-gray-400 text-sm mt-1">
                    Anonymous Gallery Privacy Policy
                  </p>
                </div>
                <button
                  onClick={() => setShowPolicyModal(false)}
                  className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Policy Content */}
              <div className="p-6">
                <div className="bg-gray-800/50 rounded-xl p-6 text-sm text-gray-300">
                  <h4 className="font-bold text-white mb-3 text-center text-lg">Comprehensive Terms of Service  Anonymous Gallery Privacy Policy</h4>
                  <p className="text-xs text-gray-400 mb-4 text-center">Last Updated: September 27, 2025</p>
                  
                  <div className="space-y-4 text-xs leading-relaxed max-h-96 overflow-y-auto">
                    <div>
                      <h5 className="font-semibold text-white mb-2">:</h5>
                      <p>this  ("")    ‌   ("")   Anonymous Gallery ("" "") is   is  from ‌       does.   is  from this  to   to   in           this  is.  with this    from to is from  ‌with.</p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 1: </h5>
                      <p><strong>:</strong>  ‌ Anonymous Gallery.com ‌ API     ‌  with .</p>
                      <p><strong>:</strong>    that from  is does.</p>
                      <p><strong>:</strong>       Other  that   in  with     will be.</p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 2:  </h5>
                      <p>Anonymous Gallery   this for ‌    (Photo) is.  this    does          from    in     .</p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 3: ‌   </h5>
                      <p>  ‌ that from   for     is .    ‌  that from    in   will be.     is:</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        <li>with     ‌  Violent ‌    .</li>
                        <li>    (‌  )    Other    .</li>
                        <li>     (     ).</li>
                        <li> for   ‌photo     for is   .</li>
                        <li>is from with‌       for  to     .</li>
                        <li>  in     with   ‌  .</li>
                      </ul>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 4:    (UGC)</h5>
                      <p><strong>4.1.   :</strong>      that with ‌         from     is. Anonymous Gallery ‌  in with   ‌     does.</p>
                      <p><strong>4.2.   to :</strong> with with           from (Royalty-Free)    with     (Sublicensable) to Anonymous Gallery  ‌.</p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 5: is  to   ‌</h5>
                      <p>Anonymous Gallery to      ‌.   that  in   ‌     is  ‌    to in  copyright@pabede.com  ...</p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 6:   from ‌</h5>
                      <p> "‌ that " (AS IS)  "with  " (WITH ALL FAULTS)  will be.  ‌      ‌.</p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 7:  </h5>
                      <p>   from   Anonymous Gallery    in              .</p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 8:  </h5>
                      <p>  ‌ that from Anonymous Gallery    this  in                   from.</p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 9:     </h5>
                      <p>this          will be.      from this   in  ‌    .</p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 10:  in </h5>
                      <p>   in   this   with   .   in ‌      with in with  to‌ will be.</p>
                    </div>

                    <div>
                      <h5 className="font-semibold text-white mb-2"> 11:  </h5>
                      <p><strong>‌:</strong>   from this        Other ‌ to   with  .</p>
                      <p><strong> :</strong> this       Anonymous Gallery   ‌      (  ) will be.</p>
                    </div>
                  </div>
                </div>

                {/* Accept Button */}
                <div className="mt-6 flex justify-center">
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setShowPolicyModal(false)
                      if (showCaptcha) {
                        setShowCaptcha(true) // Re-open captcha modal if it was closed
                      }
                    }}
                    className="bg-gradient-to-r from-pink-500 to-rose-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-lg transition-all duration-300"
                  >
                      
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default FloatingActions