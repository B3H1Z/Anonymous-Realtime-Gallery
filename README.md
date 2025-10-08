# Anonymous Online Gallery 📸

A modern, anonymous photo sharing platform with admin moderation. Built with React, Express, and SQLite.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen)](https://nodejs.org/)

## ✨ Features

- **🖼️ Live Photo Gallery**: Responsive masonry grid with infinite scroll
- **📤 Anonymous Upload**: Simple photo upload with captcha protection
- **👨‍💼 Admin Moderation**: Complete admin panel for content approval/rejection
- **❤️ Like System**: User engagement with CAPTCHA protection against spam
- **🚩 Reporting System**: Community reporting for inappropriate content
- **🎨 Image Optimization**: Automatic processing and compression with Sharp
- **📱 Responsive Design**: Mobile-first approach with beautiful UI/UX
- **🔒 Security**: Rate limiting, input validation, and secure authentication
- **📊 Analytics**: Google Analytics integration for tracking
- **🌐 PWA Ready**: Progressive Web App capabilities

## 🎥 Demo

**[📹 Watch Full Demo Video](https://github.com/B3H1Z/Anonymous-Realtime-Gallery/releases/download/v1.0.0/Screen-Capture-Anon-Gallery.mp4)**

*See the Anonymous Gallery in action - from photo upload to admin moderation!*

https://github.com/B3H1Z/Anonymous-Realtime-Gallery/releases/download/v1.0.0/Screen-Capture-Anon-Gallery.mp4

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm
- Modern web browser

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/anonymous-online-gallery.git
   cd anonymous-online-gallery
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and configure your settings (see Configuration section below)

4. Build the frontend:
   ```bash
   npm run build
   ```

5. Start the server:
   ```bash
   npm start
   ```

6. Open your browser and navigate to `http://localhost:3000`

### Development Mode

For development with hot reload:
```bash
npm run dev:full
```

This runs both the backend server and Vite dev server concurrently.

## 📁 Project Structure

```
├── index.html              # Main HTML entry point
├── server.js               # Express backend server
├── database.js             # SQLite database configuration
├── database-schema.sql     # Database schema
├── package.json            # Node.js dependencies
├── vite.config.js          # Vite configuration
├── tailwind.config.js      # Tailwind CSS configuration
├── middleware/             # Express middlewares
│   ├── auth.js            # Authentication middleware
│   ├── rateLimit.js       # Rate limiting
│   ├── validation.js      # Input validation
│   └── logging.js         # Request logging
├── src/                    # React source code
│   ├── App.jsx            # Main App component
│   ├── main.jsx           # React entry point
│   ├── index.css          # Global styles
│   ├── components/        # Reusable components
│   │   ├── FloatingActions.jsx
│   │   ├── PhotoCard.jsx
│   │   ├── AdminPhotoCard.jsx
│   │   └── ReportModal.jsx
│   ├── pages/             # Page components
│   │   ├── Gallery.jsx    # Main gallery page
│   │   ├── Admin.jsx      # Admin panel
│   │   ├── Login.jsx      # Admin login
│   │   └── Terms.jsx      # Terms of service
│   ├── hooks/             # Custom React hooks
│   │   └── useImageFilter.js
│   └── utils/             # Utility functions
│       ├── analytics.js   # Google Analytics
│       ├── notifications.js
│       └── toast.js
└── public/                # Static assets
    └── images/            # Uploaded images (auto-created)
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the root directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=production

# Admin Credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_secure_password_here

# JWT Secret (generate a strong random string)
JWT_SECRET=your_jwt_secret_key_here

# HCaptcha Configuration (get keys from https://www.hcaptcha.com/)
HCAPTCHA_SITE_KEY=your_hcaptcha_site_key
HCAPTCHA_SECRET_KEY=your_hcaptcha_secret_key

# Google Analytics (optional)
VITE_GA_MEASUREMENT_ID=G-XXXXXXXXXX

# Upload Configuration
MAX_FILE_SIZE=5242880  # 5MB in bytes
ALLOWED_MIME_TYPES=image/jpeg,image/png,image/webp
```

### Image Processing Settings

Default settings (can be modified in `server.js`):
- **Output format**: WebP
- **Max width**: 1200px
- **Quality**: 80%
- **Max file size**: 5MB

## 🛠️ API Endpoints

### Public Endpoints

#### Photos
- `GET /api/photos` - Get paginated approved photos
  - Query params: `page` (default: 0), `limit` (default: 20), `sort` (recent/popular)
- `POST /api/photos/upload` - Upload new photo (requires captcha)
- `POST /api/photos/:id/like` - Like a photo (requires captcha)
- `POST /api/photos/:id/report` - Report inappropriate photo

### Admin Endpoints (require authentication)

#### Authentication
- `POST /api/admin/login` - Admin login
- `POST /api/admin/refresh` - Refresh JWT token
- `POST /api/admin/logout` - Logout

#### Photo Management
- `GET /api/admin/photos/pending` - Get pending photos
- `POST /api/admin/photos/:id/approve` - Approve photo
- `POST /api/admin/photos/:id/reject` - Reject photo
- `DELETE /api/admin/photos/:id` - Delete photo
- `GET /api/admin/photos` - Get all photos with filtering

#### Reports & Stats
- `GET /api/admin/reports` - Get reported photos
- `GET /api/admin/stats` - Get platform statistics

## 🔒 Security Features

- **Authentication**: JWT-based admin authentication with refresh tokens
- **Rate Limiting**: Prevents abuse and DOS attacks
- **CAPTCHA Protection**: HCaptcha integration for uploads and likes
- **Input Validation**: Comprehensive validation using express-validator
- **File Validation**: MIME type checking and file size limits
- **SQL Injection Protection**: Parameterized queries with better-sqlite3
- **XSS Protection**: Helmet.js security headers
- **CORS**: Configured CORS policies

## 👨‍💼 Admin Panel

Access the admin panel at `/admin` route:

1. Login with admin credentials
2. Review pending photo submissions
3. Approve or reject photos
4. Monitor reported content
5. View platform statistics
6. Manage approved photos

Default admin credentials (change in `.env`):
- Username: `admin`
- Password: Set in `.env` file

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🎨 Customization

### Styling
The app uses Tailwind CSS for styling. Customize colors, spacing, and components in:
- `tailwind.config.js` - Tailwind configuration
- `src/index.css` - Global styles and custom classes

### Features
- Edit components in `src/components/` and `src/pages/`
- Modify backend logic in `server.js`
- Add new API endpoints in `server.js`
- Customize image processing in the upload handler

## 🧪 Development

### Adding New Features

1. **Frontend changes**: Edit React components in `src/`
2. **Backend changes**: Modify `server.js` or add middleware
3. **Database changes**: Update `database-schema.sql` and migration logic
4. **Restart**: Run `npm run build && npm start`

### Code Style
- Modern ES6+ JavaScript/JSX
- React functional components with hooks
- Responsive design principles
- Semantic HTML elements
- Accessible UI components

## 📄 Legal Compliance

The platform includes:
- Terms of Service agreement
- Content ownership confirmation
- Prohibited content guidelines
- Anonymity and privacy notices
- Admin moderation rights
- Community reporting system

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with [React](https://reactjs.org/)
- Styled with [Tailwind CSS](https://tailwindcss.com/)
- Server powered by [Express](https://expressjs.com/)
- Database: [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)
- Image processing: [Sharp](https://sharp.pixelplumbing.com/)
- Icons: [Lucide React](https://lucide.dev/)
- Animations: [Framer Motion](https://www.framer.com/motion/)

## 💬 Support

For support or questions:
- Check browser console for errors
- Verify all dependencies are installed
- Review server logs for backend issues
- Ensure proper file permissions
- Check `.env` configuration



---
