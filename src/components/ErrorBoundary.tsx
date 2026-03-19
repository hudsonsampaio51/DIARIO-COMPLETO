import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    const self = this as any;
    const { hasError, error } = self.state;
    const { children } = self.props;

    if (hasError) {
      let errorMessage = 'Ocorreu um erro inesperado.';
      
      try {
        if (error?.message) {
          const parsedError = JSON.parse(error.message);
          if (parsedError.error && parsedError.error.includes('insufficient permissions')) {
            errorMessage = 'Você não tem permissão para realizar esta operação.';
          }
        }
      } catch (e) {
        // Not a JSON error
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 p-4 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Ops! Algo deu errado.</h2>
            <p className="text-slate-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-xl transition-all"
            >
              Recarregar Página
            </button>
          </div>
        </div>
      );
    }

    return children;
  }
}
