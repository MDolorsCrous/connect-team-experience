import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LocaleContext, DEFAULT_LOCALE } from './i18n';
import { Landing } from './pages/Landing';
import { Privacy } from './pages/Privacy';

export function App() {
  return (
    <LocaleContext.Provider value={DEFAULT_LOCALE}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/privacitat" element={<Privacy />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </LocaleContext.Provider>
  );
}
