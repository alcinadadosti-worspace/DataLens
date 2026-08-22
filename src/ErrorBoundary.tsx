import React from 'react';

interface State { error: Error | null }

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', minHeight: '100vh', padding: 32, gap: 16,
          background: '#FAF7F2', fontFamily: 'system-ui, sans-serif',
        }}>
          <div style={{ fontSize: 32, color: '#B83A3A' }}>⚠</div>
          <div style={{ fontSize: 18, fontWeight: 600, color: '#1C1814' }}>
            Erro na aplicação
          </div>
          <div style={{
            background: '#FBE5E9', border: '1px solid #F0A8B3',
            borderRadius: 10, padding: '12px 18px', maxWidth: 600, width: '100%',
            fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#B83A3A',
            whiteSpace: 'pre-wrap', wordBreak: 'break-all',
          }}>
            {this.state.error.message}
            {'\n\n'}
            {this.state.error.stack}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            style={{
              padding: '10px 24px', borderRadius: 8, border: 'none',
              background: '#1C1814', color: 'white', cursor: 'pointer', fontSize: 14,
            }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
