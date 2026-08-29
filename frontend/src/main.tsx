import { StrictMode, Component, type ReactNode, type ErrorInfo } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ModeProvider } from './context/ModeContext'
import './index.css'
import Router from './router'

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error in application:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-white">
          <div className="max-w-md w-full p-6 rounded-3xl border border-red-500/30 bg-red-950/20 text-center space-y-4 shadow-2xl">
            <div className="text-4xl animate-bounce">⚠️</div>
            <h2 className="text-xl font-black text-red-400">Simulation View Notice</h2>
            <p className="text-xs text-slate-300">
              {this.state.error?.message || "A rendering transition occurred."}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-bold text-xs transition-all cursor-pointer"
            >
              🔄 Reload Factory Engine
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <ModeProvider>
          <Router />
        </ModeProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
