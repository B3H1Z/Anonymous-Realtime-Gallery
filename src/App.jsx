import React from 'react'
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import Gallery from './pages/Gallery'
import Admin from './pages/Admin'
import Login from './pages/Login'
import Terms from './pages/Terms'
import FloatingActions from './components/FloatingActions'
import { trackPageView } from './utils/analytics'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      cacheTime: 1000 * 60 * 10, // 10 minutes
    },
  },
})

// Protected Route component for admin access
const ProtectedRoute = ({ children }) => {
  const [isValidating, setIsValidating] = React.useState(true)
  const [isAuthenticated, setIsAuthenticated] = React.useState(false)

  React.useEffect(() => {
    const validateAccess = async () => {
      const token = localStorage.getItem('adminToken')
      
      if (!token) {
        setIsAuthenticated(false)
        setIsValidating(false)
        return
      }

      // Check if token looks like a proper JWT
      const tokenParts = token.split('.')
      if (tokenParts.length !== 3) {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminRefreshToken')
        setIsAuthenticated(false)
        setIsValidating(false)
        return
      }

      try {
        // Validate token with server
        const response = await fetch('/api/admin/stats', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          setIsAuthenticated(true)
        } else {
          localStorage.clear()
          setIsAuthenticated(false)
        }
      } catch (error) {
        localStorage.removeItem('adminToken')
        localStorage.removeItem('adminRefreshToken')
        setIsAuthenticated(false)
      }
      
      setIsValidating(false)
    }

    validateAccess()
  }, [])

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin w-8 h-8 border-2 border-red-400 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p>Validating access...</p>
        </div>
      </div>
    )
  }

  return isAuthenticated ? children : <Navigate to="/login?authFailed=true" replace />
}

// Component to conditionally render FloatingActions
const ConditionalFloatingActions = () => {
  const location = useLocation()
  
  // Track page views on route change
  React.useEffect(() => {
    const pageTitles = {
      '/': 'Gallery - Anonymous Gallery',
      '/login': 'Admin Login - Anonymous Gallery',
      '/admin': 'Admin Panel - Anonymous Gallery',
      '/terms': 'Terms of Service - Anonymous Gallery'
    }
    
    const title = pageTitles[location.pathname] || 'Anonymous Gallery'
    trackPageView(location.pathname, title)
  }, [location])
  
  // Only show FloatingActions on the main gallery page
  if (location.pathname === '/') {
    return <FloatingActions />
  }
  
  return null
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <div className="min-h-screen bg-gray-900 text-white">
          <Routes>
            <Route path="/" element={<Gallery />} />
            <Route path="/login" element={<Login />} />
            <Route path="/admin" element={
              <ProtectedRoute>
                <Admin />
              </ProtectedRoute>
            } />
            <Route path="/terms" element={<Terms />} />
          </Routes>
          <ConditionalFloatingActions />
          <Toaster
            position="top-left"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgba(31, 41, 55, 0.8)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                color: '#fff',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
              },
            }}
          />
        </div>
      </Router>
    </QueryClientProvider>
  )
}

export default App