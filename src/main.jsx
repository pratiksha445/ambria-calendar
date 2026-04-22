import React from 'react'
import ReactDOM from 'react-dom/client'
import { LanguageProvider } from './i18n/LanguageContext.jsx'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <LanguageProvider>
      <App />
    </LanguageProvider>
  </React.StrictMode>,
)
