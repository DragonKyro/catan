import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
// The theme's display fonts (headings, the big gold buttons), used on the
// menus and in the game alike.
import '@fontsource/alegreya-sc/latin-700.css';
import '@fontsource/alegreya-sc/latin-900.css';
import '@fontsource/alegreya/latin-500-italic.css';
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
