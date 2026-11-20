// Reusable Application Footer Component
// Displays dynamic copyright year and server-persisted unique visitor count.
import { formatVisitorCount } from '../services/visitorService.js';

export function renderFooter({ visitorCount = null, year = new Date().getFullYear() } = {}) {
  const hasValidCount = typeof visitorCount === 'number' && Number.isFinite(visitorCount) && visitorCount >= 0;
  const formattedCount = hasValidCount ? formatVisitorCount(visitorCount) : '';

  return `
    <footer class="app-footer" id="app-footer" role="contentinfo">
      <div class="app-footer-inner">
        <p class="app-footer-copyright">
          &copy; ${year} James Phillip De Guzman. All rights reserved.
        </p>
        ${hasValidCount ? `
          <div class="app-footer-visitors" id="app-footer-visitors" aria-label="Unique visitors count">
            <span class="app-footer-visitor-dot" aria-hidden="true"></span>
            <span>Visitors: <strong class="app-footer-visitor-num">${formattedCount}</strong></span>
          </div>
        ` : ''}
      </div>
    </footer>
  `;
}
