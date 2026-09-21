import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { hardRefreshApp } from '../../lib/hard-refresh'

const links = [
  { to: '/', label: 'خانه', end: true },
  { to: '/accounts', label: 'حساب‌ها' },
  { to: '/categories', label: 'دسته‌ها' },
  { to: '/transactions', label: 'تراکنش‌ها' },
  { to: '/scheduled', label: 'تعهد/مطالبه' },
  { to: '/awaiting', label: 'نیازمند تأیید' },
  { to: '/calendar', label: 'تقویم' },
  { to: '/installments', label: 'سری‌ها' },
  { to: '/reports', label: 'ترازنامه' },
  { to: '/liquidity', label: 'نقدینگی' },
  { to: '/settings', label: 'تنظیمات' },
]

export function AppShell() {
  const [refreshing, setRefreshing] = useState(false)

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-row">
          <div>
            <h1>باحساب</h1>
            <p className="tagline">دفترچهٔ حساب شخصی لوکال</p>
          </div>
          <button
            type="button"
            className="ghost refresh-btn"
            disabled={refreshing}
            onClick={() => {
              setRefreshing(true)
              void hardRefreshApp()
            }}
          >
            {refreshing ? 'در حال بروزرسانی…' : 'بروزرسانی'}
          </button>
        </div>
      </header>
      <nav className="nav">
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
            {l.label}
          </NavLink>
        ))}
      </nav>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
