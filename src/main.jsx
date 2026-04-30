import React from 'react'
import ReactDOM from 'react-dom/client'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import { DirectoryProvider } from './contexts/DirectoryContext.jsx'
import App from './App.jsx'
import './index.css'
import './pwa.js'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <DirectoryProvider>
        <App />
      </DirectoryProvider>
    </LanguageProvider>
  </React.StrictMode>,
)
