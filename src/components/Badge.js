/**
 * Standardized high-contrast outlined badge variants across KosherAI.
 * Features crisp outlined borders, transparent inner fills, and dark/light adaptive text.
 */
export const BADGE_STYLES = {
  safe: 'border border-emerald-600/50 dark:border-emerald-400/50 bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300',
  compliant: 'border border-emerald-600/50 dark:border-emerald-400/50 bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300',
  active: 'border border-emerald-600/50 dark:border-emerald-400/50 bg-emerald-500/10 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300',

  caution: 'border border-amber-600/50 dark:border-amber-400/50 bg-amber-500/10 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300',
  moderate: 'border border-amber-600/50 dark:border-amber-400/50 bg-amber-500/10 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300',

  avoid: 'border border-rose-600/50 dark:border-rose-400/50 bg-rose-500/10 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300',
  highRisk: 'border border-rose-600/50 dark:border-rose-400/50 bg-rose-500/10 dark:bg-rose-950/30 text-rose-800 dark:text-rose-300',

  neutral: 'border border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200',
  info: 'border border-slate-300 dark:border-slate-700 bg-slate-100/60 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200'
};

/**
 * Returns class string for standard badge variant
 */
export function getBadgeClass(variant = 'neutral') {
  return BADGE_STYLES[variant] || BADGE_STYLES.neutral;
}

/**
 * HTML helper for string template rendering
 */
export function renderBadge(text, variant = 'neutral', extraClass = '') {
  const styleClass = getBadgeClass(variant);
  return `<span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold ${styleClass} ${extraClass}">${text}</span>`;
}

export default {
  BADGE_STYLES,
  getBadgeClass,
  renderBadge
};
