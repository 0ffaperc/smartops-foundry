// SmartOps Foundry — Animated S Logo Component
// Usage: <div id="logoMount"></div> then call mountLogo('#logoMount', {size:36, animated:true})
// The S path draws from bottom-to-top, dots pop in after.

function mountLogo(selectorOrEl, opts = {}) {
  const el = typeof selectorOrEl === 'string' ? document.querySelector(selectorOrEl) : selectorOrEl;
  if (!el) return;

  const size = opts.size || 36;
  const animated = opts.animated !== false;
  const variant = opts.variant || 'dark'; // 'dark' = dark bg icon, 'light' = for dark backgrounds
  const showText = opts.showText !== false;

  const strokeColor = variant === 'light' ? '#ffffff' : '#1e293b';
  const bg = variant === 'light' ? '' : '';
  const dotColor = '#3b82f6';

  // S-curve matching SmartOps Foundry brand:
  // Top-right dot → smooth S curve → bottom-left dot
  // Two bezier curves: right→left (top half), left→right→left (bottom half)
  const pathD = "M 148 52 C 148 78, 52 72, 52 100 C 52 128, 148 122, 148 148 C 148 153, 52 153, 52 153";

  const html = `
    <div class="sof-logo" style="display:inline-flex;align-items:center;gap:10px;">
      <div class="sof-logo-icon" style="
        width:${size}px;height:${size}px;border-radius:${size*0.22}px;
        background:${variant === 'light' ? 'transparent' : '#0f1525'};
        display:flex;align-items:center;justify-content:center;
        ${variant !== 'light' ? 'box-shadow:0 4px 16px rgba(15,21,37,0.3);' : ''}
        position:relative;overflow:hidden;
      ">
        <svg viewBox="0 0 200 200" width="${size*0.72}" height="${size*0.72}" style="overflow:visible;">
          <path
            class="sof-s-path"
            d="${pathD}"
            stroke="${strokeColor}"
            stroke-width="16"
            stroke-linecap="round"
            fill="none"
            ${animated ? 'style="stroke-dasharray:400;stroke-dashoffset:400;"' : ''}
          />
          <circle class="sof-dot-top" cx="148" cy="52" r="11" fill="${dotColor}"
            style="${animated ? 'opacity:0;transform-origin:148px 52px;' : ''}" />
          <circle class="sof-dot-bottom" cx="52" cy="153" r="11" fill="${dotColor}"
            style="${animated ? 'opacity:0;transform-origin:52px 153px;' : ''}" />
        </svg>
      </div>
      ${showText ? `
        <div class="sof-logo-text" style="display:flex;flex-direction:column;line-height:1;">
          <span style="font-size:${size*0.42}px;font-weight:800;letter-spacing:-0.02em;color:inherit;">SmartOps</span>
          <span style="font-size:${size*0.26}px;font-weight:500;color:${variant==='light'?'#94a3b8':'var(--text-light, #94a3b8)'};letter-spacing:0.01em;">Foundry</span>
        </div>
      ` : ''}
    </div>
  `;

  el.innerHTML = html;

  if (animated) {
    // Animate after a small delay so the browser paints first
    requestAnimationFrame(() => {
      const path = el.querySelector('.sof-s-path');
      const dotTop = el.querySelector('.sof-dot-top');
      const dotBottom = el.querySelector('.sof-dot-bottom');

      if (path) {
        path.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(0.65, 0, 0.35, 1)';
        // Bottom-to-top: start fully hidden, animate to 0 (draws the path)
        // The path is defined top-to-bottom, so we reverse by animating from -400 to 0
        path.style.strokeDashoffset = '-400';
        requestAnimationFrame(() => {
          path.style.strokeDashoffset = '0';
        });
      }

      // Bottom dot appears first (since we animate bottom-to-top)
      if (dotBottom) {
        dotBottom.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        setTimeout(() => {
          dotBottom.style.opacity = '1';
          dotBottom.style.transform = 'scale(1)';
        }, 100);
      }

      // Top dot appears when the line reaches it
      if (dotTop) {
        dotTop.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        setTimeout(() => {
          dotTop.style.opacity = '1';
          dotTop.style.transform = 'scale(1)';
        }, 1400);
      }
    });
  }
}

// Auto-mount on any element with [data-sof-logo]
function autoMountLogo() {
  document.querySelectorAll('[data-sof-logo]').forEach(el => {
    if (el.querySelector('.sof-logo')) return; // Already mounted
    const size = parseInt(el.dataset.sofSize) || 36;
    const variant = el.dataset.sofVariant || 'dark';
    const animated = el.dataset.sofAnimated !== 'false';
    const showText = el.dataset.sofText !== 'false';
    mountLogo(el, { size, variant, animated, showText });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoMountLogo);
} else {
  autoMountLogo();
}
