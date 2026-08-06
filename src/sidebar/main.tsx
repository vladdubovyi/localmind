import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatApp } from '@/components/chat/ChatApp';
import '@/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="h-screen w-full min-w-[320px]">
      <ChatApp variant="sidebar" />
    </div>
  </StrictMode>,
);
