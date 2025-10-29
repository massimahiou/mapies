# Mapies - Interactive Map Application

A powerful, interactive map application built with React, TypeScript, and Firebase. Create, manage, and share custom maps with advanced clustering, custom markers, and real-time collaboration features.

## 🚀 Features

### Core Functionality
- **Interactive Maps**: Built with Leaflet.js for smooth, responsive map interactions
- **Marker Management**: Add, edit, delete, and organize markers with custom properties
- **Clustering System**: Advanced marker clustering with enable/disable toggle and customizable radius
- **Custom Folder Icons**: Upload and manage custom icons for marker groups
- **Real-time Sync**: Live updates across all map views using Firebase Firestore

### Map Customization
- **Multiple Map Styles**: Light, dark, satellite, and toner themes
- **Marker Customization**: Shape, color, size, border, and text color options
- **Search & Filter**: Advanced search functionality with real-time filtering
- **Name Rules**: Automatic marker renaming based on customizable rules

### Data Management
- **CSV Import/Export**: Bulk import markers from CSV files with duplicate detection
- **Public Maps**: Share maps publicly with custom URLs
- **Embed Maps**: Generate iframe embed codes for external websites
- **User Authentication**: Secure user accounts with Firebase Authentication

### Advanced Features
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Location Services**: GPS integration for user location and nearby markers
- **Business Detection**: Automatic business type detection and categorization
- **Duplicate Detection**: Smart duplicate marker detection and management

## 🛠️ Tech Stack

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Maps**: Leaflet.js + Leaflet.markercluster
- **Backend**: Firebase (Authentication + Firestore + Storage)
- **Icons**: Lucide React
- **File Processing**: Papa Parse (CSV), React Dropzone
- **Routing**: React Router DOM

## 📦 Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/massimahiou/mapies.git
   cd mapies
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up Firebase**
   - Create a Firebase project
   - Enable Authentication and Firestore
   - Add your Firebase config to `src/firebase/config.ts`
   - Set up Firestore security rules from `firestore.rules`

4. **Start development server**
   ```bash
   npm run dev
   ```

## 🔧 Configuration

### Firebase Setup
1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable Authentication (Email/Password)
3. Enable Firestore Database
4. Enable Storage (for custom icons)
5. Update `src/firebase/config.ts` with your project credentials

### Environment Variables
Create a `.env` file in the root directory:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 🚀 Deployment

### Firebase Hosting
```bash
npm run build
firebase deploy --only hosting
```

### Other Platforms
The built files in the `dist/` directory can be deployed to any static hosting service:
- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── sidebar/         # Sidebar tab components
│   └── ...
├── contexts/           # React contexts (Auth, Toast)
├── firebase/           # Firebase configuration and utilities
├── hooks/              # Custom React hooks
├── utils/              # Utility functions
└── types/              # TypeScript type definitions
```

## 🔐 Security

- Firebase Authentication for user management
- Firestore security rules for data protection
- Input validation and sanitization
- Secure file upload handling
- Environment variable protection

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is proprietary software. All rights reserved.

## 🙏 Acknowledgments

- [Leaflet.js](https://leafletjs.com/) for the mapping library
- [Firebase](https://firebase.google.com/) for backend services
- [Tailwind CSS](https://tailwindcss.com/) for styling
- [Lucide React](https://lucide.dev/) for icons

## 📞 Support

For support, email support@mapies.com or create an issue in this repository.

---

**Mapies** - Making maps interactive and accessible for everyone! 🗺️✨







