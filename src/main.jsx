import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'
import { LanguageProvider } from '@/lib/LanguageContext.jsx'

class StartupErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) { return { error }; }
  render() {
    if (this.state.error) return <div style={{ padding: 24, fontFamily: 'system-ui', color: '#991b1b' }}><h1>Track&amp;Race</h1><p>Unable to start the application.</p><small>{this.state.error.message}</small></div>;
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <StartupErrorBoundary><LanguageProvider><App /></LanguageProvider></StartupErrorBoundary>
)
