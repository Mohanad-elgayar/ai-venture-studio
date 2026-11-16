import { Component, lazy, Suspense, useState, type ReactNode } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { StoreProvider, useStore } from './data/store';
import { Shell } from './components/layout/Shell';
import { Spinner } from './components/ui';
import Overview from './pages/Overview';

const ClashMatrix = lazy(() => import('./pages/ClashMatrix'));
const ClashRegister = lazy(() => import('./pages/ClashRegister'));
const Models = lazy(() => import('./pages/Models'));
const Deliverables = lazy(() => import('./pages/Deliverables'));
const Compliance = lazy(() => import('./pages/Compliance'));
const Progress = lazy(() => import('./pages/Progress'));
const Risks = lazy(() => import('./pages/Risks'));
const Reports = lazy(() => import('./pages/Reports'));
const ReportView = lazy(() => import('./pages/ReportView'));
const Import = lazy(() => import('./pages/Import'));
const Admin = lazy(() => import('./pages/Admin'));

class ErrorBoundary extends Component<{ children: ReactNode }, { error?: Error }> {
  state: { error?: Error } = {};
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) return (
      <div className="card p-6 m-6 max-w-xl">
        <h2 className="font-semibold text-crit">Something went wrong on this page</h2>
        <p className="text-sm text-muted mt-2">{this.state.error.message}</p>
        <button className="btn-primary mt-4" onClick={() => this.setState({ error: undefined })}>Try again</button>
      </div>
    );
    return this.props.children;
  }
}

function SignIn() {
  const { signIn } = useStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-full flex items-center justify-center p-6">
      <form className="card p-6 w-full max-w-sm space-y-3" onSubmit={async (e) => { e.preventDefault(); setBusy(true); setErr((await signIn(email, password)) ?? ''); setBusy(false); }}>
        <h1 className="text-lg font-semibold">BIM Coordination Center</h1>
        <p className="text-xs text-muted">Sign in with your project account. Access is governed by your role.</p>
        <input className="input" type="email" autoComplete="username" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="input" type="password" autoComplete="current-password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {err && <p className="text-xs text-crit">{err}</p>}
        <button className="btn-primary w-full justify-center" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  );
}

function Gate({ children }: { children: ReactNode }) {
  const { status, error } = useStore();
  if (status === 'auth') return <SignIn />;
  if (status === 'loading') return <Spinner text="Loading project data…" />;
  if (status === 'error') return <div className="card p-6 m-6 max-w-xl"><h2 className="font-semibold text-crit">Could not load data</h2><p className="text-sm text-muted mt-2">{error}</p></div>;
  return <>{children}</>;
}

const page = (el: ReactNode) => <ErrorBoundary><Suspense fallback={<Spinner />}>{el}</Suspense></ErrorBoundary>;

export default function App() {
  return (
    <StoreProvider>
      <HashRouter>
        <Gate>
          <Routes>
            <Route path="/report/:type" element={page(<ReportView />)} />
            <Route element={<Shell />}>
              <Route index element={page(<Overview />)} />
              <Route path="matrix" element={page(<ClashMatrix />)} />
              <Route path="clashes" element={page(<ClashRegister />)} />
              <Route path="models" element={page(<Models />)} />
              <Route path="deliverables" element={page(<Deliverables />)} />
              <Route path="compliance" element={page(<Compliance />)} />
              <Route path="progress" element={page(<Progress />)} />
              <Route path="risks" element={page(<Risks />)} />
              <Route path="reports" element={page(<Reports />)} />
              <Route path="import" element={page(<Import />)} />
              <Route path="admin" element={page(<Admin />)} />
              <Route path="*" element={<div className="card p-6">Page not found.</div>} />
            </Route>
          </Routes>
        </Gate>
      </HashRouter>
    </StoreProvider>
  );
}
