import { Route, Routes } from 'react-router-dom'

import { PublicOnly, RequireAuth } from './auth/guards'
import AppShell from './components/AppShell'
import ForgotPassword from './pages/ForgotPassword'
import Home from './pages/Home'
import Login from './pages/Login'
import Placeholder from './pages/Placeholder'
import Register from './pages/Register'
import VerifyEmail from './pages/VerifyEmail'

export default function App() {
  return (
    <Routes>
      {/* Public: reachable only while signed out. */}
      <Route element={<PublicOnly />}>
        <Route path="/register" element={<Register />} />
        <Route path="/verify-email" element={<VerifyEmail />} />
        <Route path="/login" element={<Login />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
      </Route>

      {/* Everything behind the shell requires a session. */}
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/cashbook" element={<Placeholder title="Cashbook" />} />
          <Route path="/dealers" element={<Placeholder title="Dealers" />} />
          <Route path="/bills" element={<Placeholder title="Bills" />} />
          <Route path="/payments" element={<Placeholder title="Payments" />} />
          <Route path="/tasks" element={<Placeholder title="Tasks" />} />
          <Route path="/reports/outstanding" element={<Placeholder title="Outstanding report" />} />
          <Route path="/settings" element={<Placeholder title="Settings" />} />
        </Route>
      </Route>

      <Route path="*" element={<Placeholder title="Page not found" />} />
    </Routes>
  )
}
