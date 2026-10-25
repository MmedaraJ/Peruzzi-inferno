import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource/marcellus/400.css';
import '@fontsource/marcellus-sc/400.css';
import '@fontsource-variable/eb-garamond';
import '@fontsource-variable/eb-garamond/wght-italic.css';
import './styles.css';
import App from './App';
import { askEarly } from './lib/early';

// opened on one of the stage's addresses: ask the server what the stage needs while its code downloads
if (/^\/(notes(\/|$)|tracklist$|answer\/|$)/.test(location.pathname)) askEarly();

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
