import { Navigate, useLocation } from 'react-router-dom'
import { loginPathWithNext } from '@/lib/auth-api'

/** Send expired/unauthenticated admin views back to Login (no demo access). */
export function RequireLoginRedirect() {
  const location = useLocation()
  return (
    <Navigate
      to={loginPathWithNext(`${location.pathname}${location.search}`)}
      replace
    />
  )
}
