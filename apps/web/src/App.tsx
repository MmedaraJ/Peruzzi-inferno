import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useHistoryNotes, useScrollMemory } from './lib/history';
import { loadStage } from './lazy';

const Asked = lazy(loadStage);
const PublicNotePage = lazy(() => import('./screens/PublicPages').then((m) => ({ default: m.PublicNotePage })));
const PublicTracklistPage = lazy(() => import('./screens/PublicPages').then((m) => ({ default: m.PublicTracklistPage })));
const Admin = lazy(() => import('./screens/admin/Admin'));
// the labs are for development only, and aren't built into the site
const lab = (name: 'OgLab' | 'CardLab') => (import.meta.env.DEV ? lazy(() => import('./screens/Lab').then((m) => ({ default: m[name] }))) : () => null);
const OgLab = lab('OgLab');
const CardLab = lab('CardLab');
const ViewportDebug = lazy(() => import('./components/ViewportDebug').then((m) => ({ default: m.ViewportDebug })));
// ?debug=vp: the screen's measures on screen, for the rest of the visit
const debugVp = (() => { try { if (new URLSearchParams(location.search).get('debug') === 'vp') sessionStorage.setItem('pa.debug', 'vp'); return sessionStorage.getItem('pa.debug') === 'vp'; } catch { return false; } })();

/** There's no front page: the site opens on a note. */
export default function App() {
  useHistoryNotes(); useScrollMemory();
  return (
    <Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      {debugVp && <Suspense fallback={null}><ViewportDebug /></Suspense>}
      <Routes>
        <Route path="/" element={<Asked />} />
        <Route path="/notes" element={<Asked />} />
        <Route path="/notes/:id" element={<Asked />} />
        <Route path="/tracklist" element={<Asked />} />
        <Route path="/answer/:code" element={<Asked />} />
        <Route path="/question/:code" element={<PublicNotePage />} />
        <Route path="/tracks/:code" element={<PublicTracklistPage />} />
        <Route path="/admin/*" element={<Admin />} />
        {import.meta.env.DEV && <Route path="/lab/og" element={<OgLab />} />}
        {import.meta.env.DEV && <Route path="/lab/cards" element={<CardLab />} />}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
