import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './styles/tokens.css'

import GuestLanding from './pages/GuestLanding'
import Giveaway from './pages/Giveaway'
import AdminLogin from './pages/AdminLogin'
import ProtectedRoute from './components/admin/ProtectedRoute'
import AdminLayout from './pages/admin/AdminLayout'
import Dashboard from './pages/admin/Dashboard'
import Content from './pages/admin/Content'
import Pricing from './pages/admin/Pricing'
import Calendar from './pages/admin/Calendar'
import Inquiries from './pages/admin/Inquiries'
import Bookings from './pages/admin/Bookings'
import Photos from './pages/admin/Photos'
import AdminGiveaway from './pages/admin/Giveaway'
import Reservations from './pages/admin/Reservations'
import Cleaning from './pages/admin/Cleaning'
import Ownership from './pages/admin/Ownership'
import Objectives from './pages/admin/Objectives'
import Meetings from './pages/admin/Meetings'
import Meeting from './pages/admin/Meeting'
import Reports from './pages/admin/Reports'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GuestLanding />} />
        <Route path="/giveaway" element={<Giveaway />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
        <Route
          path="/admin"
          element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}
        >
          <Route path="ownership" element={<Ownership />} />
          <Route path="objectives" element={<Objectives />} />
          <Route path="meetings" element={<Meetings />} />
          <Route path="meetings/:id" element={<Meeting />} />
          <Route path="reports" element={<Reports />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="content" element={<Content />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="calendar" element={<Navigate to="/admin/connections" replace />} />
          <Route path="connections" element={<Calendar />} />
          <Route path="stats" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="inquiries" element={<Inquiries />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="photos" element={<Photos />} />
          <Route path="giveaway" element={<AdminGiveaway />} />
          <Route path="reservations" element={<Reservations />} />
          <Route path="cleaning" element={<Cleaning />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
