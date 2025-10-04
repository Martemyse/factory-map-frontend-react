import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Layout/Navbar'
import ViewerPage from './pages/ViewerPage'
import SettingsPage from './pages/SettingsPage'
import './App.css'

function App() {
  return (
    <div className="app">
      <Navbar />
      <div style={{ borderTop: '1px solid #e2e8f0' }}>
        <Routes>
          <Route path="/" element={<ViewerPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  )
}

export default App
