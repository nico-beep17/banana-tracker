import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App.jsx'

// Global crash handler — auto-reload once on chunk/module errors (stale PWA cache),
// then show error visibly if it persists.
const RELOAD_KEY = 'lavc_crash_reload';
window.addEventListener('error', (e) => {
  console.error('[GLOBAL CRASH]', e.error);
  const msg = e.error?.message || e.message || '';
  // Auto-reload once for stale module/chunk errors
  if ((msg.includes('Failed to fetch') || msg.includes('is not defined') || msg.includes('dynamically imported'))
      && !sessionStorage.getItem(RELOAD_KEY)) {
    sessionStorage.setItem(RELOAD_KEY, '1');
    window.location.reload();
    return;
  }
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `<div style="padding:2rem;color:red;font-family:monospace"><h1>CRASH</h1><pre>${e.error?.stack || e.message}</pre><button onclick="sessionStorage.clear();window.location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;font-size:1rem;cursor:pointer">↻ Reload App</button></div>`;
  }
});
window.addEventListener('unhandledrejection', (e) => {
  console.error('[UNHANDLED PROMISE]', e.reason);
});
// Clear the reload flag on successful load so future crashes can also auto-reload
window.addEventListener('load', () => sessionStorage.removeItem(RELOAD_KEY));

class TopLevelErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false, error: null }; }
  static getDerivedStateFromError(error) { return { hasError: true, error }; }
  componentDidCatch(error, info) {
    console.error('[TopLevelErrorBoundary]', error, info);
    // Auto-reload once for stale chunk errors
    const msg = error?.message || '';
    if ((msg.includes('Failed to fetch') || msg.includes('is not defined') || msg.includes('dynamically imported'))
        && !sessionStorage.getItem(RELOAD_KEY)) {
      sessionStorage.setItem(RELOAD_KEY, '1');
      window.location.reload();
    }
  }
  render() {
    if (this.state.hasError) {
      return <div style={{ padding: '2rem', color: 'red', fontFamily: 'monospace' }}>
        <h1>APP CRASH</h1>
        <pre>{this.state.error?.stack || String(this.state.error)}</pre>
        <button onClick={() => { sessionStorage.clear(); window.location.reload(); }} style={{ marginTop: '1rem', padding: '0.5rem 1rem', fontSize: '1rem', cursor: 'pointer' }}>↻ Reload App</button>
      </div>;
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
