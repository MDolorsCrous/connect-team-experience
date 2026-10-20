import { lazy, Suspense } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LocaleContext, DEFAULT_LOCALE } from './i18n';
import { Landing } from './pages/Landing';
import { Privacy } from './pages/Privacy';

// El panell privat es carrega a part: el públic no descarrega el seu codi
const Admin = lazy(() => import('./admin/AdminApp'));

export function App() {
  return (
    <LocaleContext.Provider value={DEFAULT_LOCALE}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/privacitat" element={<Privacy />} />
          <Route
            path="/admin/*"
            element={
              <Suspense fallback={<p className="p-10 text-center">Carregant…</p>}>
                <Admin />
              </Suspense>
            }
          />
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </LocaleContext.Provider>
  );
}
