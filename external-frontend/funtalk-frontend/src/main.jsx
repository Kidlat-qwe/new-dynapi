import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import GlobalAlert from './components/GlobalAlert.jsx';
import GlobalConfirm from './components/GlobalConfirm.jsx';

/**
 * Prevent mouse-wheel from changing <select> and <input type="number"> values on hover.
 * Instead, forward the wheel to page scrolling.
 */
function installNoWheelValueChange() {
  const handler = (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const isSelect = t.tagName === 'SELECT';
    const isNumberInput = t.tagName === 'INPUT' && t.getAttribute('type') === 'number';
    if (!isSelect && !isNumberInput) return;

    // stop the control from consuming the wheel (changing value)
    e.preventDefault();

    // scroll the page instead
    window.scrollBy({ top: e.deltaY, left: 0, behavior: 'auto' });
  };

  window.addEventListener('wheel', handler, { passive: false, capture: true });
}

installNoWheelValueChange();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <GlobalAlert />
    <GlobalConfirm />
  </StrictMode>,
)
