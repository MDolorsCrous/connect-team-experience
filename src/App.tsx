import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { LocaleContext, DEFAULT_LOCALE } from './i18n';
import { Landing } from './pages/Landing';

export function App() {
  return (
    <LocaleContext.Provider value={DEFAULT_LOCALE}>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="*" element={<Landing />} />
        </Routes>
      </BrowserRouter>
    </LocaleContext.Provider>
  );
}
