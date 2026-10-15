import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'sonner'
import App from '@/App'
import { ThemeProvider, useTheme } from '@/context/ThemeContext'
import '@/index.css'

function ThemedToaster() {
  const { theme } = useTheme()
  return <Toaster richColors position="top-right" theme={theme} />
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <App />
        <ThemedToaster />
      </ThemeProvider>
    </BrowserRouter>
  </StrictMode>,
)
