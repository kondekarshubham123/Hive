import PropTypes from 'prop-types'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../store/authContext'

function ChatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function WalletIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" />
      <path d="M3 5v14a2 2 0 0 0 2 2h16v-5" />
      <path d="M18 12a2 2 0 0 0 0 4h4v-4z" />
    </svg>
  )
}

function StarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5" aria-hidden="true">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}

function LogoutIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  )
}

const NAV_ITEMS = [
  { path: '/chat', label: 'Chat', Icon: ChatIcon },
  { path: '/planner', label: 'Planner', Icon: CalendarIcon },
  { path: '/expenses', label: 'Wallet', Icon: WalletIcon },
  { path: '/priorities', label: 'Priorities', Icon: StarIcon },
]

const SIDEBAR_LINK_BASE =
  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150'
const SIDEBAR_LINK_ACTIVE = 'bg-primary-600 text-white'
const SIDEBAR_LINK_INACTIVE = 'text-surface-400 hover:bg-surface-800 hover:text-white'

const BOTTOM_LINK_BASE =
  'flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors duration-150 min-w-[52px]'
const BOTTOM_LINK_ACTIVE = 'text-primary-400'
const BOTTOM_LINK_INACTIVE = 'text-surface-500 hover:text-surface-300'

function SidebarNavLink({ path, label, Icon }) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `${SIDEBAR_LINK_BASE} ${isActive ? SIDEBAR_LINK_ACTIVE : SIDEBAR_LINK_INACTIVE}`
      }
      aria-label={label}
    >
      <Icon />
      {label}
    </NavLink>
  )
}

SidebarNavLink.propTypes = {
  path: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  Icon: PropTypes.elementType.isRequired,
}

function BottomNavLink({ path, label, Icon }) {
  return (
    <NavLink
      to={path}
      className={({ isActive }) =>
        `${BOTTOM_LINK_BASE} ${isActive ? BOTTOM_LINK_ACTIVE : BOTTOM_LINK_INACTIVE}`
      }
      aria-label={label}
    >
      <Icon />
      <span>{label}</span>
    </NavLink>
  )
}

BottomNavLink.propTypes = {
  path: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  Icon: PropTypes.elementType.isRequired,
}

export default function Layout({ children }) {
  const { user, logout } = useAuth()

  return (
    <div className="flex h-screen bg-surface-950 overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex md:flex-col md:w-60 bg-surface-900 border-r border-surface-800 shrink-0">
        <div className="flex items-center gap-2 px-4 py-5 border-b border-surface-800">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-sm">H</span>
          </div>
          <span className="text-lg font-bold text-white">Hive</span>
        </div>

        <nav className="flex-1 p-3 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => (
            <SidebarNavLink key={item.path} path={item.path} label={item.label} Icon={item.Icon} />
          ))}
        </nav>

        <div className="p-4 border-t border-surface-800 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.name ?? 'User'}</p>
            <p className="text-xs text-surface-500 truncate">ID: {user?.id ?? ''}</p>
          </div>
          <button
            onClick={logout}
            className="p-1.5 rounded-md text-surface-400 hover:text-white hover:bg-surface-800 transition-colors"
            aria-label="Log out"
            title="Log out"
          >
            <LogoutIcon />
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Mobile top bar */}
        <header className="md:hidden flex items-center justify-between px-4 py-3 bg-surface-900 border-b border-surface-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary-600 rounded-md flex items-center justify-center">
              <span className="text-white font-bold text-xs">H</span>
            </div>
            <span className="text-base font-bold text-white">Hive</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-surface-400 truncate max-w-[120px]">{user?.name}</span>
            <button
              onClick={logout}
              className="p-1.5 rounded-md text-surface-400 hover:text-white hover:bg-surface-800 transition-colors"
              aria-label="Log out"
            >
              <LogoutIcon />
            </button>
          </div>
        </header>

        {/* Desktop top bar */}
        <header className="hidden md:flex items-center justify-between px-6 py-3 bg-surface-900 border-b border-surface-800 shrink-0">
          <h1 className="text-sm text-surface-400">
            Welcome back, <span className="text-white font-medium">{user?.name}</span>
          </h1>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto pb-16 md:pb-0" id="main-content">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 bg-surface-900 border-t border-surface-800 flex justify-around items-center px-2 py-1.5 z-50"
        aria-label="Bottom navigation"
      >
        {NAV_ITEMS.map((item) => (
          <BottomNavLink key={item.path} path={item.path} label={item.label} Icon={item.Icon} />
        ))}
      </nav>
    </div>
  )
}

Layout.propTypes = {
  children: PropTypes.node.isRequired,
}
