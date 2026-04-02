import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

// Global crash handler — write error visibly to the page so we never get a silent white screen
window.addEventListener('error', (e) => {
  console.error('[GLOBAL CRASH]', e.error);
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `<div style="padding:2rem;color:red;font-family:monospace"><h1>GLOBAL CRASH</h1><pre>${e.error?.stack || e.message}</pre></div>`;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED PROMISE]', e.reason);
});

class TopLevelErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) { console.error('[TopLevelErrorBoundary]', error, info); }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}><h1>APP CRASH</h1><pre>{this.state.error?.stack || String(this.state.error)}</pre></div>;
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // Data remains fresh for 5 minutes
      refetchOnWindowFocus: true,
    },
  },
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <TopLevelErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </TopLevelErrorBoundary>
  </StrictMode>,
)
