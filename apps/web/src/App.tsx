import { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, useLocation } from 'react-router-dom';
import { ConnectWallet } from './components/ConnectWallet';
import { Landing } from './pages/Landing';
import { Registry } from './pages/Registry';
import { Developers } from './pages/Developers';
import { Auditors } from './pages/Auditors';
import { Dashboard } from './pages/Dashboard';
import { Docs } from './pages/Docs';
import { Home } from './pages/Home';
import { Leaderboard } from './pages/Leaderboard';
import { AuditorProfile } from './pages/AuditorProfile';
import { RegisterAuditor } from './pages/RegisterAuditor';
import { RegisterSkill } from './pages/RegisterSkill';
import { Verify } from './pages/Verify';
import { Status } from './pages/Status';

type Tab = 'home' | 'auditor' | 'skill' | 'verify' | 'status';

const TABS: { id: Tab; label: string }[] = [
  { id: 'home', label: 'Home' },
  { id: 'verify', label: 'Verify Skill' },
  { id: 'auditor', label: 'Register Auditor' },
  { id: 'skill', label: 'Submit Skill' },
  { id: 'status', label: 'Status' },
];

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function DApp() {
  const [tab, setTab] = useState<Tab>('home');
  return (
    <div className="app-container">
      <header className="app-header">
        <a href="#/" className="app-logo" style={{ cursor: 'pointer', textDecoration: 'none', color: 'inherit' }}>
          <span>AEGIS</span> Protocol
        </a>
        <ConnectWallet />
      </header>

      <nav className="nav-tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`nav-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      <main>
        {tab === 'home' && <Home onNavigate={setTab} />}
        {tab === 'auditor' && <RegisterAuditor />}
        {tab === 'skill' && <RegisterSkill />}
        {tab === 'verify' && <Verify />}
        {tab === 'status' && <Status />}
      </main>
    </div>
  );
}

export function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/registry" element={<Registry />} />
        <Route path="/developers" element={<Developers />} />
        <Route path="/auditors" element={<Auditors />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/leaderboard" element={<Leaderboard />} />
        <Route path="/auditor/:commitment" element={<AuditorProfile />} />
        <Route path="/docs" element={<Docs />} />
        <Route path="/app" element={<DApp />} />
      </Routes>
    </HashRouter>
  );
}
