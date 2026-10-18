import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './style.css'

// Step 1: Vite starts here and mounts the screen. Next, go to Step 2 in App.tsx.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
