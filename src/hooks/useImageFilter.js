import { useState, useEffect, useCallback } from 'react'

// Cache for image existence checks to avoid repeated requests
const imageCache = new Map()

const checkImageExists = async (imagePath) => {
  // Return cached result if available
  if (imageCache.has(imagePath)) {
    return imageCache.get(imagePath)
  }

  try {
    // Use the server-side image check API instead of loading images in browser
    const filename = imagePath.split('/').pop()
    const response = await fetch(`/api/images/check/${filename}`)
    
    if (response.ok) {
      const { exists } = await response.json()
      imageCache.set(imagePath, exists)
      return exists
    } else {
      // Fallback to client-side check if API doesn't exist yet
      return await clientSideImageCheck(imagePath)
    }
  } catch (error) {
    // Fallback to client-side check if API fails
    return await clientSideImageCheck(imagePath)
  }
}

const clientSideImageCheck = async (imagePath) => {
  return new Promise((resolve) => {
    const img = new Image()
    
    img.onload = () => {
      imageCache.set(imagePath, true)
      resolve(true)
    }
    
    img.onerror = () => {
      imageCache.set(imagePath, false)
      resolve(false)
    }
    
    img.src = imagePath
  })
}

export const useImageFilter = (photos) => {
  const [filteredPhotos, setFilteredPhotos] = useState([])
  const [isFiltering, setIsFiltering] = useState(false)

  const filterPhotos = useCallback(async (photoList) => {
    if (!photoList || photoList.length === 0) {
      setFilteredPhotos([])
      return
    }

    setIsFiltering(true)
    
    try {
      // In development mode, we need to check against the backend API
      const isDevelopment = import.meta.env.DEV
      const baseURL = isDevelopment ? 'http://localhost:3000' : ''
      
      // Use client-side image checking for all photos
      
      // Fallback: Accept all photos and let individual components handle missing images
      // This prevents the 404 errors during development
      if (isDevelopment) {
        setFilteredPhotos(photoList)
      } else {
        // In production, do the individual checks
        const checks = photoList.map(async (photo) => {
          const imageExists = await checkImageExists(`/images/${photo.filename}`)
          return imageExists ? photo : null
        })

        const results = await Promise.all(checks)
        const validPhotos = results.filter(photo => photo !== null)
        setFilteredPhotos(validPhotos)
      }
    } catch (error) {
      setFilteredPhotos(photoList) // Fallback to showing all if filtering fails
    } finally {
      setIsFiltering(false)
    }
  }, [])

  // Add methods to update photos without reloading
  const addPhoto = useCallback((newPhoto) => {
    setFilteredPhotos(prev => [newPhoto, ...prev])
  }, [])

  const updatePhoto = useCallback((photoId, updates) => {
    setFilteredPhotos(prev => 
      prev.map(photo => 
        photo.id === photoId ? { ...photo, ...updates } : photo
      )
    )
  }, [])

  const removePhoto = useCallback((photoId) => {
    setFilteredPhotos(prev => prev.filter(photo => photo.id !== photoId))
  }, [])

  useEffect(() => {
    filterPhotos(photos)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos]) // Only depend on photos to avoid infinite loop

  return { 
    filteredPhotos, 
    isFiltering,
    addPhoto,
    updatePhoto,
    removePhoto,
    setFilteredPhotos
  }
}

export default useImageFilter