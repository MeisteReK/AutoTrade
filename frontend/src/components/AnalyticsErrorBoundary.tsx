import React from "react";

// Error Boundary dla zakładki Analizy
export class AnalyticsErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null; errorInfo: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: "" };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error, errorInfo: error.message || String(error) };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Błąd w zakładce Analizy:", error);
    console.error("Szczegóły błędu:", errorInfo);
    console.error("Stack trace:", error.stack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <section>
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-2">Analizy zaawansowane</h2>
            <div className="p-4 bg-red-900/20 border border-red-700/50 rounded text-sm text-red-300">
              <p className="font-semibold mb-2">Wystąpił błąd podczas ładowania analiz.</p>
              <p className="mb-2 text-xs text-red-400 font-mono">
                {this.state.errorInfo || "Nieznany błąd"}
              </p>
              <p className="mb-3 text-xs text-slate-400">
                Sprawdź konsolę przeglądarki (F12) dla szczegółów.
              </p>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: null, errorInfo: "" });
                }}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition-colors mr-2"
              >
                Spróbuj ponownie
              </button>
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded text-white text-sm transition-colors"
              >
                Odśwież stronę
              </button>
            </div>
          </div>
        </section>
      );
    }

    return this.props.children;
  }
}

