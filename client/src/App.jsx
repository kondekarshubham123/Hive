import PropTypes from 'prop-types'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './store/authContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Chat from './pages/Chat'
import Planner from './pages/Planner'
import Expenses from './pages/Expenses'
import Priorities from './pages/Priorities'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-surface-400 text-sm">Loading Hive...</span>
        </div>
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  return children
}

ProtectedRoute.propTypes = {
  children: PropTypes.node.isRequired,
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-surface-950">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-surface-400 text-sm">Loading Hive...</span>
        </div>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={user ? <Navigate to="/chat" replace /> : <Login />}
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Navigate to="/chat" replace />
          </ProtectedRoute>
        }
      />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <Layout>
              <Chat />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/planner"
        element={
          <ProtectedRoute>
            <Layout>
              <Planner />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute>
            <Layout>
              <Expenses />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/priorities"
        element={
          <ProtectedRoute>
            <Layout>
              <Priorities />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
