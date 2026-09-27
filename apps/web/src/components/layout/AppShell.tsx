import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { hardRefreshApp } from '../../lib/hard-refresh'

type NavItem = { to: string; label: string; end?: boolean }
type NavGroup = { label: string; items: NavItem[] }

const navGroups: NavGroup[] = [
  {
    label: 'اصلی',
    items: [{ to: '/', label: 'خانه', end: true }],
  },
  {
    label: 'مالی',
    items: [
      { to: '/accounts', label: 'حساب‌ها' },
      { to: '/categories', label: 'دسته‌ها' },
      { to: '/transactions', label: 'تراکنش‌ها' },
    ],
  },
  {
    label: 'تعهدات',
    items: [
      { to: '/scheduled', label: 'تعهد / مطالبه' },
      { to: '/awaiting', label: 'نیازمند تأیید' },
      { to: '/calendar', label: 'تقویم' },
      { to: '/installments', label: 'سری‌ها' },
    ],
  },
  {
    label: 'گزارش',
    items: [
      { to: '/reports', label: 'ترازنامه' },
      { to: '/liquidity', label: 'نقدینگی' },
    ],
  },
  {
    label: 'سیستم',
    items: [{ to: '/settings', label: 'تنظیمات' }],
  },
]

const pageTitles: { match: string; end?: boolean; title: string }[] = [
  { match: '/', end: true, title: 'خانه' },
  { match: '/accounts', title: 'حساب‌ها' },
  { match: '/categories', title: 'دسته‌ها' },
  { match: '/transactions', title: 'تراکنش‌ها' },
  { match: '/scheduled', title: 'تعهد / مطالبه' },
  { match: '/awaiting', title: 'نیازمند تأیید' },
  { match: '/calendar', title: 'تقویم' },
  { match: '/installments', title: 'سری‌ها' },
  { match: '/reports', title: 'ترازنامه' },
  { match: '/liquidity', title: 'نقدینگی' },
  { match: '/settings', title: 'تنظیمات' },
]

function titleForPath(pathname: string): string {
  for (const p of pageTitles) {
    if (p.end) {
      if (pathname === p.match) return p.title
    } else if (pathname === p.match || pathname.startsWith(`${p.match}/`)) {
      return p.title
    }
  }
  return 'باحساب'
}

export function AppShell() {
  const location = useLocation()
  const [refreshing, setRefreshing] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const pageTitle = useMemo(() => titleForPath(location.pathname), [location.pathname])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!menuOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [menuOpen])

  return (
    <div className={menuOpen ? 'app-shell nav-open' : 'app-shell'}>
      {menuOpen && (
        <button
          type="button"
          className="nav-backdrop"
          aria-label="بستن منو"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className="sidebar" id="site-nav" aria-label="منوی اصلی">
        <NavLink to="/" className="brand" end onClick={() => setMenuOpen(false)}>
          <span className="brand-mark" aria-hidden>
            ب
          </span>
          <span className="brand-text">
            <strong>باحساب</strong>
            <span>دفترچهٔ حساب شخصی</span>
          </span>
        </NavLink>

        <nav className="sidebar-nav">
          {navGroups.map((group) => (
            <div key={group.label} className="nav-group">
              <div className="nav-label">{group.label}</div>
              <ul className="nav-list">
                {group.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) =>
                        isActive ? 'nav-item active' : 'nav-item'
                      }
                      onClick={() => setMenuOpen(false)}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </aside>

      <div className="main">
        <header className="topbar">
          <div className="topbar-start">
            <button
              type="button"
              className="btn icon nav-burger"
              aria-label={menuOpen ? 'بستن منو' : 'باز کردن منو'}
              aria-expanded={menuOpen}
              aria-controls="site-nav"
              onClick={() => setMenuOpen((v) => !v)}
            >
              <span className={menuOpen ? 'burger-lines open' : 'burger-lines'} aria-hidden>
                <i />
                <i />
                <i />
              </span>
            </button>
            <div className="topbar-title-block">
              <h1 className="topbar-title">{pageTitle}</h1>
            </div>
          </div>
          <div className="topbar-actions">
            <button
              type="button"
              className="btn ghost sm"
              disabled={refreshing}
              onClick={() => {
                setRefreshing(true)
                void hardRefreshApp()
              }}
            >
              {refreshing ? '…' : 'بروزرسانی'}
            </button>
          </div>
        </header>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
