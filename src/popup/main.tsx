import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatApp } from '@/components/chat/ChatApp';
import '@/styles/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="h-[600px] w-[380px]">
      <ChatApp variant="popup" />
    </div>
  </StrictMode>,
);
