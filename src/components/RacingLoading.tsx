type RacingVariant = 'lights' | 'car';

/** 本地 SVG/CSS 实现，不请求外部动画，也不模拟加载百分比。 */
export function RacingLoadingGraphic({ variant }: { variant: RacingVariant }) {
  if (variant === 'lights') {
    return (
      <div className='apex-start-lights' aria-hidden='true'>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} className='apex-light-column'>
            <i /><i />
          </span>
        ))}
      </div>
    );
  }

  return (
    <div className='apex-race-scene' aria-hidden='true'>
      <svg className='apex-race-car' viewBox='0 0 240 110' fill='none'>
        <g className='apex-car-body'>
          <path d='M29 65h20l18-17h53l15 9 57 10 20 12H28z' fill='currentColor' />
          <path d='M72 48l13-17h31l13 27M36 64V39m-13 0h28M197 70h21v11h-30' stroke='var(--race-ink)' strokeWidth='6' strokeLinejoin='round' />
          <path d='M91 46V34h20l8 12' fill='var(--race-ink)' />
          <path d='M76 65h53l23 8H68' stroke='var(--race-silver)' strokeWidth='5' />
        </g>
        {[58, 178].map((cx) => (
          <g key={cx} className='apex-car-wheel' style={{ transformOrigin: `${cx}px 78px` }}>
            <circle cx={cx} cy='78' r='19' fill='var(--race-tire)' />
            <circle cx={cx} cy='78' r='10' stroke='var(--race-silver)' strokeWidth='3' />
            <path d={`M${cx - 8} 78h16m-8-8v16`} stroke='var(--race-silver)' strokeWidth='2' />
          </g>
        ))}
      </svg>
      <div className='apex-race-road'><span /></div>
    </div>
  );
}

export default function RacingLoading({
  variant,
  message,
  steps,
  activeStepIdx,
  onDark = false,
  failed = false,
}: {
  variant: RacingVariant;
  message: string;
  steps: readonly { label: string }[];
  activeStepIdx: number;
  onDark?: boolean;
  failed?: boolean;
}) {
  return (
    <div className={`mtv-load mtv-load-race-${variant}${onDark ? ' mtv-on-dark' : ''}`}>
      <div className={`apex-race-loading${failed ? ' is-error' : ''}`}>
        <RacingLoadingGraphic variant={variant} />
        <p className='apex-race-message' role='status' aria-live='polite'>
          {failed ? '加载中断' : message}
        </p>
        {!failed && !onDark && steps.length > 0 && (
          <ol className='apex-race-steps' aria-label='加载阶段'>
            {steps.map((step, i) => (
              <li key={step.label} className={i < activeStepIdx ? 'is-done' : ''} aria-current={i === activeStepIdx ? 'step' : undefined}>
                <span aria-hidden='true' />{step.label}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
