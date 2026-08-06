import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RedirectToSidePanel } from '@/popup/RedirectToSidePanel';
import '@/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RedirectToSidePanel />
  </StrictMode>,
);
