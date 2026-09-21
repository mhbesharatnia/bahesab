import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { useDueBootstrap } from './hooks/useDueBootstrap'
import { useArvanSync } from './hooks/useArvanSync'
import { AccountsPage } from './pages/AccountsPage'
import { AwaitingConfirmPage } from './pages/AwaitingConfirmPage'
import { CalendarPage } from './pages/CalendarPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { HomePage } from './pages/HomePage'
import { InstallmentsPage } from './pages/InstallmentsPage'
import { LiquidityPage } from './pages/LiquidityPage'
import { ReportsPage } from './pages/ReportsPage'
import { ScheduledPage } from './pages/ScheduledPage'
import { SettingsPage } from './pages/SettingsPage'
import { TransactionsPage } from './pages/TransactionsPage'
import { ensureBootstrap } from './lib/db'
import { useEffect, useState } from 'react'

export default function App() {
  const [booted, setBooted] = useState(false)
  const due = useDueBootstrap()
  useArvanSync(booted && due.ready)

  useEffect(() => {
    void ensureBootstrap().then(() => setBooted(true))
  }, [])

  if (!booted || !due.ready) {
    return <p className="boot">در حال آماده‌سازی باحساب…</p>
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<HomePage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="scheduled" element={<ScheduledPage />} />
          <Route path="awaiting" element={<AwaitingConfirmPage />} />
          <Route path="calendar" element={<CalendarPage />} />
          <Route path="installments" element={<InstallmentsPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="liquidity" element={<LiquidityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
