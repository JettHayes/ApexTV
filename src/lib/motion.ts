/** JS 发起的平滑滚动不受 CSS scroll-behavior 约束，需按系统「减少动态效果」自行降级 */
export const smoothScrollBehavior = (): ScrollBehavior =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ? 'auto'
    : 'smooth';
