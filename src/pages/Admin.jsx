import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import AdminPhotoCard from '../components/AdminPhotoCard'
import ReportPhotoCard from '../components/ReportPhotoCard'
import { useImageFilter } from '../hooks/useImageFilter'
import {
    Shield,
    Users,
    Image,
    AlertTriangle,
    TrendingUp,
    Eye,
    X,
    Check,
    Trash2,
    LogIn,
    LogOut,
    RefreshCw,
    Calendar,
    Heart,
    Flag,
    Clock,
    FileImage,
    BarChart3
} from 'lucide-react'
import toast from 'react-hot-toast'

const Admin = () => {
    const navigate = useNavigate()
    const [activeTab, setActiveTab] = useState('pending')
    const [pendingPhotos, setPendingPhotos] = useState([])
    const [livePhotos, setLivePhotos] = useState([])
    const [reports, setReports] = useState([])
    
    // Infinite loading state for live photos
    const [livePage, setLivePage] = useState(0)
    const [hasMoreLive, setHasMoreLive] = useState(true)
    const [loadingMore, setLoadingMore] = useState(false)
    const [totalLivePhotos, setTotalLivePhotos] = useState(0)
    
    // Filter out photos with missing images
    const { filteredPhotos: filteredPendingPhotos, isFiltering: isFilteringPending } = useImageFilter(pendingPhotos)
    const { filteredPhotos: filteredLivePhotos, isFiltering: isFilteringLive } = useImageFilter(livePhotos)
    const [stats, setStats] = useState({
        totalPhotos: 0,
        pendingPhotos: 0,
        totalLikes: 0,
        totalReports: 0,
        recentUploads: 0
    })
    const [selectedPhoto, setSelectedPhoto] = useState(null)
    const [loading, setLoading] = useState(false)

    // API helper function
    const apiCall = async (endpoint, options = {}) => {
        const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`
        const currentToken = localStorage.getItem('adminToken')
        
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...(currentToken && { Authorization: `Bearer ${currentToken}` }),
                ...options.headers
            },
            ...options
        }

        const response = await fetch(url, config)
        const data = await response.json()

        if (!response.ok) {
            throw new Error(data.error || 'API call failed')
        }

        return data
    }

    const handleLogout = () => {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminRefreshToken')
        toast.success('Logged out successfully', {
            icon: '👋',
            position: 'top-left'
        })
        navigate('/login')
    }    // Data loading
    const loadPendingPhotos = async () => {
        try {
            const response = await apiCall('/admin/pending')
            setPendingPhotos(response.photos)
        } catch (error) {
            toast.error('Failed to load pending photos')
        }
    }

    const loadLivePhotos = async (page = 0, append = false) => {
        try {
            if (page === 0) {
                setLoadingMore(false)
            } else {
                setLoadingMore(true)
            }
            
            const response = await apiCall(`/admin/photos?page=${page}&limit=50`)
            
            if (append) {
                setLivePhotos(prev => [...prev, ...response.photos])
            } else {
                setLivePhotos(response.photos)
            }
            
            setHasMoreLive(response.hasMore)
            setTotalLivePhotos(response.total || 0)
            setLivePage(page)
            setLoadingMore(false)
        } catch (error) {
            toast.error('Failed to load live photos')
            setLoadingMore(false)
        }
    }
    
    const loadMoreLivePhotos = () => {
        if (!loadingMore && hasMoreLive) {
            loadLivePhotos(livePage + 1, true)
        }
    }

    const loadReports = async () => {
        try {
            const response = await apiCall('/admin/reports')
            setReports(response.reports)
        } catch (error) {
            toast.error('Failed to load reports')
        }
    }

    // Group reports by photo
    const groupReportsByPhoto = (reports) => {
        const grouped = {}
        reports.forEach(report => {
            if (!grouped[report.photo_id]) {
                grouped[report.photo_id] = {
                    photo_id: report.photo_id,
                    filename: report.filename,
                    original_name: report.original_name,
                    reports: [],
                    reportCount: 0,
                    latestReportDate: null,
                    reasons: new Set()
                }
            }
            grouped[report.photo_id].reports.push(report)
            grouped[report.photo_id].reportCount++
            if (report.reason) {
                grouped[report.photo_id].reasons.add(report.reason)
            }
            // Update latest report date
            const reportDate = new Date(report.reported_at)
            if (!grouped[report.photo_id].latestReportDate || reportDate > grouped[report.photo_id].latestReportDate) {
                grouped[report.photo_id].latestReportDate = reportDate
            }
        })
        return Object.values(grouped)
    }

    // Format reason for display
    const formatReason = (reason) => {
        const reasonMap = {
            'inappropriate_content': 'Inappropriate Content',
            'spam': 'Spam',
            'violence': 'Violent',
            'copyright_violation': 'Copyright Violation',
            'harassment': 'Harassment',
            'nudity': 'Nudity',
            'other': 'Other',
            'user_reported': 'User Reported'
        }
        return reasonMap[reason] || reason
    }

    // Photo management functions
    const approvePhoto = async (photoId) => {
        try {
            await apiCall(`/admin/photos/${photoId}/approve`, {
                method: 'POST'
            })
            toast.success('Photo approved successfully', {
                icon: '✅',
                position: 'top-left'
            })
            loadPendingPhotos() // Refresh the pending list
        } catch (error) {
            toast.error('Failed to approve photo: ' + error.message, {
                icon: '❌',
                position: 'top-left'
            })
        }
    }

    const rejectPhoto = async (photoId) => {
        try {
            await apiCall(`/admin/photos/${photoId}/reject`, {
                method: 'POST'
            })
            toast.success('Photo rejected successfully', {
                icon: '🚫',
                position: 'top-left'
            })
            loadPendingPhotos() // Refresh the pending list
        } catch (error) {
            toast.error('Failed to reject photo: ' + error.message, {
                icon: '❌',
                position: 'top-left'
            })
        }
    }

    const deletePhoto = async (photoId) => {
        if (!confirm('Are you sure you want to delete this photo? This action cannot be undone.')) {
            return
        }

        try {
            await apiCall(`/admin/photos/${photoId}`, {
                method: 'DELETE'
            })
            toast.success('Photo deleted successfully', {
                icon: '🗑️',
                position: 'top-left'
            })
            loadLivePhotos() // Refresh the live photos list
        } catch (error) {
            toast.error('Failed to delete photo: ' + error.message, {
                icon: '❌',
                position: 'top-left'
            })
        }
    }

    // Remove reported photo
    const removeReportedPhoto = async (photoId) => {
        if (!confirm('Are you sure you want to delete this reported photo? This action cannot be undone.')) {
            return
        }

        try {
            await apiCall(`/admin/photos/${photoId}/delete-reported`, {
                method: 'DELETE'
            })
            toast.success('Reported photo deleted successfully', {
                icon: '🗑️',
                position: 'top-left'
            })
            loadReports() // Refresh the reports list
        } catch (error) {
            toast.error('Failed to delete reported photo: ' + error.message, {
                icon: '❌',
                position: 'top-left'
            })
        }
    }

    const loadStats = async () => {
        try {
            const response = await apiCall('/admin/stats')
            setStats(response.stats)
        } catch (error) {
        }
    }

    const loadData = () => {
        loadPendingPhotos()
        loadLivePhotos(0, false) // Reset to first page
        loadReports()
        loadStats()
    }

    // Load data on component mount (authentication is handled by ProtectedRoute)
    useEffect(() => {
        loadData()
    }, [])
    
    // Infinite scroll handler for live photos
    useEffect(() => {
        if (activeTab !== 'live') return
        
        const handleScroll = () => {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop
            const scrollHeight = document.documentElement.scrollHeight
            const clientHeight = document.documentElement.clientHeight
            
            // Load more when user is 300px from bottom
            if (scrollTop + clientHeight >= scrollHeight - 300) {
                loadMoreLivePhotos()
            }
        }
        
        window.addEventListener('scroll', handleScroll)
        return () => window.removeEventListener('scroll', handleScroll)
    }, [activeTab, loadingMore, hasMoreLive, livePage])

    // Auto-refresh data
    useEffect(() => {
        const interval = setInterval(loadData, 30000) // Refresh every 30 seconds
        return () => clearInterval(interval)
    }, [])

    return (
        <div className="min-h-screen bg-gray-900 text-white" dir="ltr">
            {/* Header */}
            <div className="bg-gray-800/50 backdrop-blur-lg border-b border-gray-700/50 p-6">
                <div className="max-w-7xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-purple-400 rounded-xl flex items-center justify-center text-xl">
                            <Shield />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">Admin Panel</h1>
                            <p className="text-gray-400 text-sm">Anonymous Gallery Content Management</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={loadData}
                            className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
                            title="Refresh Data"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors"
                        >
                            <LogOut className="w-4 h-4" />
                            Logout
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto p-6">
                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                    <div className="bg-gray-800/30 p-4 rounded-lg text-center border border-gray-700/30">
                        <FileImage className="w-8 h-8 mx-auto mb-2 text-pink-400" />
                        <div className="text-2xl font-bold text-white">{stats.totalPhotos}</div>
                        <div className="text-gray-400 text-xs">Total Photos</div>
                    </div>
                    <div className="bg-gray-800/30 p-4 rounded-lg text-center border border-gray-700/30">
                        <Clock className="w-8 h-8 mx-auto mb-2 text-yellow-400" />
                        <div className="text-2xl font-bold text-white">{stats.pendingPhotos}</div>
                        <div className="text-gray-400 text-xs">Pending Review</div>
                    </div>
                    <div className="bg-gray-800/30 p-4 rounded-lg text-center border border-gray-700/30">
                        <Heart className="w-8 h-8 mx-auto mb-2 text-red-400" />
                        <div className="text-2xl font-bold text-white">{stats.totalLikes}</div>
                        <div className="text-gray-400 text-xs">Total Likes</div>
                    </div>
                    <div className="bg-gray-800/30 p-4 rounded-lg text-center border border-gray-700/30">
                        <Flag className="w-8 h-8 mx-auto mb-2 text-orange-400" />
                        <div className="text-2xl font-bold text-white">{stats.totalReports}</div>
                        <div className="text-gray-400 text-xs">Reports</div>
                    </div>
                    <div className="bg-gray-800/30 p-4 rounded-lg text-center border border-gray-700/30">
                        <Calendar className="w-8 h-8 mx-auto mb-2 text-green-400" />
                        <div className="text-2xl font-bold text-white">{stats.recentUploads}</div>
                        <div className="text-gray-400 text-xs">Recent (7d)</div>
                    </div>
                </div>

                {/* Tabs */}
                <div className="bg-gray-800/30 rounded-lg p-1 mb-8 border border-gray-700/30">
                    <div className="flex gap-1">
                        {[
                            { id: 'pending', label: 'Pending Review', icon: Clock },
                            { id: 'live', label: 'Live Photos', icon: Eye },
                            { id: 'reports', label: 'Reports', icon: Flag }
                        ].map(tab => {
                            const Icon = tab.icon
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 py-3 px-4 rounded-md text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                                        activeTab === tab.id
                                            ? 'bg-gray-700/50 text-gray-300'
                                            : 'text-gray-400 hover:text-white hover:bg-gray-700/30'
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                    {tab.label}
                                    {tab.id === 'pending' && filteredPendingPhotos.length > 0 && (
                                        <span className="bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
                                            {filteredPendingPhotos.length}
                                        </span>
                                    )}
                                    {tab.id === 'reports' && reports.length > 0 && (
                                        <span className="bg-orange-500 text-white text-xs rounded-full px-1.5 py-0.5">
                                            {reports.length}
                                        </span>
                                    )}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {/* Tab Content */}
                <AnimatePresence mode="wait">
                    {activeTab === 'pending' && (
                        <motion.div
                            key="pending"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/30"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold">Photos Pending Review</h2>
                                <span className="bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full text-sm">
                                                                            {pendingPhotos.length} photos
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {pendingPhotos.map(photo => (
                                    <AdminPhotoCard
                                        key={photo.id}
                                        photo={photo}
                                        type="pending"
                                        onView={setSelectedPhoto}
                                        onApprove={approvePhoto}
                                        onReject={rejectPhoto}
                                    />
                                ))}
                            </div>

                            {pendingPhotos.length === 0 && !isFilteringPending && (
                                <div className="text-center py-12">
                                    <Image className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                                    <p className="text-gray-400">No photos pending review</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'live' && (
                        <motion.div
                            key="live"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/30"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold">Live Photos</h2>
                                <span className="bg-gray-700/50 text-gray-300 px-3 py-1 rounded-full text-sm">
                                    {totalLivePhotos} total ({livePhotos.length} loaded)
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {livePhotos.map(photo => (
                                    <AdminPhotoCard
                                        key={photo.id}
                                        photo={photo}
                                        type="live"
                                        onView={setSelectedPhoto}
                                        onDelete={deletePhoto}
                                    />
                                ))}
                            </div>

                            {loadingMore && (
                                <div className="text-center py-8">
                                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-pink-500"></div>
                                    <p className="text-gray-400 mt-2">Loading more photos...</p>
                                </div>
                            )}
                            
                            {!hasMoreLive && livePhotos.length > 0 && (
                                <div className="text-center py-8">
                                    <p className="text-gray-500">All photos loaded</p>
                                </div>
                            )}

                            {livePhotos.length === 0 && !isFilteringLive && !loadingMore && (
                                <div className="text-center py-12">
                                    <Eye className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                                    <p className="text-gray-400">No live photos</p>
                                </div>
                            )}
                        </motion.div>
                    )}

                    {activeTab === 'reports' && (
                        <motion.div
                            key="reports"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="bg-gray-800/30 rounded-lg p-6 border border-gray-700/30"
                        >
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-xl font-semibold">User Reports</h2>
                                <span className="bg-orange-500/20 text-orange-400 px-3 py-1 rounded-full text-sm font-medium">
                                    {reports.length} reports
                                </span>
                            </div>

                            {reports.length > 0 ? (
                                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                    {groupReportsByPhoto(reports).map((photoGroup, index) => (
                                        <ReportPhotoCard
                                            key={photoGroup.photo_id}
                                            photoGroup={photoGroup}
                                            index={index}
                                            onDelete={removeReportedPhoto}
                                            formatReasonText={formatReason}
                                        />
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <Flag className="w-16 h-16 mx-auto mb-4 text-gray-600" />
                                    <p className="text-gray-400">No reports</p>
                                </div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Photo Viewer Modal */}
            <AnimatePresence>
                {selectedPhoto && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                        onClick={() => setSelectedPhoto(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="relative max-w-4xl max-h-[90vh] w-full"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Close Button */}
                            <button
                                onClick={() => setSelectedPhoto(null)}
                                className="absolute -top-12 right-0 p-2 bg-gray-800/80 hover:bg-gray-700 rounded-full text-white transition-colors z-10"
                            >
                                <X className="w-6 h-6" />
                            </button>

                            {/* Image */}
                            <div className="bg-gray-900 rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl">
                                <img
                                    src={`/images/${selectedPhoto.filename}`}
                                    alt="Full size preview"
                                    className="w-full h-auto max-h-[80vh] object-contain"
                                />
                                
                                {/* Photo Info */}
                                <div className="p-4 bg-gray-800/50 border-t border-gray-700/50">
                                    <div className="flex items-center justify-between text-sm text-gray-300">
                                        <span className="truncate mr-4">{selectedPhoto.original_name}</span>
                                        <div className="flex items-center gap-4 flex-shrink-0">
                                            {selectedPhoto.likes !== undefined && (
                                                <span className="flex items-center gap-1">
                                                    <Heart className="w-4 h-4 text-red-400" />
                                                    {selectedPhoto.likes}
                                                </span>
                                            )}
                                            {selectedPhoto.report_count !== undefined && selectedPhoto.report_count > 0 && (
                                                <span className="flex items-center gap-1">
                                                    <Flag className="w-4 h-4 text-orange-400" />
                                                    {selectedPhoto.report_count}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

export default Admin