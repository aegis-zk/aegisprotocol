import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Registry } from './pages/Registry';
import { Developers } from './pages/Developers';
import { Auditors } from './pages/Auditors';
import { Dashboard } from './pages/Dashboard';
import { Docs } from './pages/Docs';
// Leaderboard is now a tab within Auditors page
import { AuditorProfile } from './pages/AuditorProfile';
import { DAppPage } from './pages/DAppPage';
import { Bounties } from './pages/Bounties';

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export function App() {
  return (
    <HashRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/app" element={<DAppPage />} />
        <Route path="/registry" element={<Registry />} />
        <Route path="/developers" element={<Developers />} />
        <Route path="/auditors" element={<Auditors />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/bounties" element={<Bounties />} />
        <Route path="/leaderboard" element={<Navigate to="/auditors" replace />} />
        <Route path="/auditor/:commitment" element={<AuditorProfile />} />
        <Route path="/docs" element={<Docs />} />
      </Routes>
    </HashRouter>
  );
}
