import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackMessage?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  declare props: Readonly<Props>;
  declare state: Readonly<State>;
  declare setState: (state: Partial<State> | ((prevState: Readonly<State>, props: Readonly<Props>) => Partial<State> | null)) => void;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-white rounded-3xl p-8 border border-rose-200 shadow-lg text-center max-w-md mx-auto my-8 space-y-4">
          <div className="w-16 h-16 rounded-full bg-rose-100 text-[#D6001C] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8" />
          </div>

          <div className="space-y-1">
            <h3 className="font-black text-slate-900 text-lg">
              {this.props.fallbackTitle || 'Something went wrong'}
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              {this.props.fallbackMessage ||
                this.state.error?.message ||
                'Unable to sync with Firestore servers. Please check your connection and try again.'}
            </p>
          </div>

          <button
            onClick={this.handleRetry}
            className="w-full bg-[#D6001C] hover:bg-red-700 text-white font-extrabold py-3.5 px-6 rounded-2xl text-xs flex items-center justify-center gap-2 shadow-md shadow-red-500/20 transition-all cursor-pointer active:scale-95"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Retry Connection</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
