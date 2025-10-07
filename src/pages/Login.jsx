import React, { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { Shield, LogIn, RefreshCw } from 'lucide-react'
import HCaptcha from '@hcaptcha/react-hcaptcha'
import toast from 'react-hot-toast'

const Login = () => {
    const navigate = useNavigate()
    const captchaRef = useRef()
    const [loginData, setLoginData] = useState({ username: '', password: '' })
    const [loading, setLoading] = useState(false)
    const [captchaToken, setCaptchaToken] = useState(null)

    // Clear any existing tokens when login page loads (but not if coming from failed auth)
    React.useEffect(() => {
        // Only clear tokens if we're not coming from an auth failure redirect
        const params = new URLSearchParams(window.location.search)
        const fromAuthFailure = params.has('authFailed')
        
        if (!fromAuthFailure) {
            localStorage.removeItem('adminToken')
            localStorage.removeItem('adminRefreshToken')
        } else {
        }
    }, [])

    // API helper function
    const apiCall = async (endpoint, options = {}) => {
        const url = endpoint.startsWith('http') ? endpoint : `/api${endpoint}`
        const config = {
            headers: {
                'Content-Type': 'application/json',
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

    // hCaptcha handlers
    const handleCaptchaVerify = (token) => {
        setCaptchaToken(token)
    }

    const handleCaptchaExpire = () => {
        setCaptchaToken(null)
    }

    const handleCaptchaError = (error) => {
        setCaptchaToken(null)
        toast.error('Captcha verification failed. Please try again.', {
            icon: '🔒',
            position: 'top-left'
        })
    }

    // Authentication
    const handleLogin = async (e) => {
        e.preventDefault()
        
        // Validate captcha verification
        if (!captchaToken) {
            toast.error('Please complete the captcha verification', {
                icon: '⚠️',
                position: 'top-left'
            })
            return
        }
        
        setLoading(true)

        try {
            const response = await apiCall('/admin/login', {
                method: 'POST',
                body: JSON.stringify({ ...loginData, captchaToken })
            })

            // Store tokens in localStorage (server returns accessToken and refreshToken)
            const accessToken = response.accessToken
            const refreshToken = response.refreshToken
            
            if (accessToken && refreshToken && typeof accessToken === 'string' && typeof refreshToken === 'string') {
                localStorage.setItem('adminToken', accessToken)
                localStorage.setItem('adminRefreshToken', refreshToken)
                
                // Verify storage
                const storedToken = localStorage.getItem('adminToken')
            } else {
                throw new Error(`Login response missing valid tokens. AccessToken: ${typeof accessToken}, RefreshToken: ${typeof refreshToken}`)
            }

            toast.success('Login successful!', {
                icon: '✅',
                position: 'top-left'
            })

            // Reset captcha
            setCaptchaToken(null)
            if (captchaRef.current) {
                captchaRef.current.resetCaptcha()
            }

            // Redirect to admin panel
            setTimeout(() => {
                navigate('/admin')
            }, 1000)

        } catch (error) {
            toast.error(error.message, {
                icon: '❌',
                position: 'top-left'
            })
            // Reset captcha on error
            setCaptchaToken(null)
            if (captchaRef.current) {
                captchaRef.current.resetCaptcha()
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4" dir="ltr">
            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="w-full max-w-md"
            >
                <div className="bg-gray-800/50 backdrop-blur-lg rounded-2xl border border-gray-700/50 p-8 shadow-2xl">
                    <div className="text-center mb-8">
                        <div className="w-16 h-16 bg-gradient-to-br from-red-400 to-purple-400 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
                            <Shield />
                        </div>
                        <h1 className="text-2xl font-bold text-white mb-2">Admin Login</h1>
                        <p className="text-gray-400">Access the Anonymous Gallery admin panel</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Username
                            </label>
                            <input
                                type="text"
                                value={loginData.username}
                                onChange={(e) => setLoginData(prev => ({ ...prev, username: e.target.value }))}
                                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                                placeholder="Enter your username"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">
                                Password
                            </label>
                            <input
                                type="password"
                                value={loginData.password}
                                onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent"
                                placeholder="Enter your password"
                                required
                            />
                        </div>
                        <div className="flex flex-col items-center space-y-3">
                            <p className="text-sm text-gray-300 text-center">
                                Please verify you are not a bot
                            </p>
                            <div className="flex justify-center" >
                                <HCaptcha
                                    ref={captchaRef}
                                    sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY || "10000000-ffff-ffff-ffff-000000000001"}
                                    onVerify={handleCaptchaVerify}
                                    onExpire={handleCaptchaExpire}
                                    onError={handleCaptchaError}
                                    theme="dark"
                                    size="normal"
                                    hl="en"
                                />
                            </div>
                        </div>

                        <button
                            type="submit"
                            disabled={loading || !captchaToken}
                            className="w-full bg-gradient-to-r from-red-400 to-purple-400 text-white py-3 rounded-lg font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <LogIn className="w-4 h-4" />
                            )}
                            {loading ? 'Signing in...' : 'Sign In'}
                        </button>
                    </form>

                </div>
            </motion.div>
        </div>
    )
}

export default Login