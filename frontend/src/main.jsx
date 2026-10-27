import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { initI18n } from './i18n'
import './index.css'

initI18n().then(() => {
  ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
})
