import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from 'react-error-boundary'

import App from './App.tsx'
import { ErrorFallback } from './ErrorFallback.tsx'
import { ThemeProvider } from './components/ThemeProvider.tsx'

import './main.css'
import './styles/theme.css'
import './index.css'

if (typeof window !== 'undefined') {
  import('@github/spark/spark').catch((error) => {
    console.warn(
      '[main] Unable to load Spark runtime; falling back to local storage state management.',
      error
    )
  })
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary FallbackComponent={ErrorFallback}>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark-professional"
      themes={['dark-professional', 'light-clean', 'dark-green', 'current-fixed', 'hacker']}
    >
      <App />
    </ThemeProvider>
  </ErrorBoundary>
)
