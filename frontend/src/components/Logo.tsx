type LogoProps = { size?: number; showText?: boolean; textSize?: string };

function Logo({ size = 32, showText = true, textSize = '1.25rem' }: LogoProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="2" y="2" width="12" height="12" rx="3" fill="#3b82f6" />
        <rect x="18" y="2" width="12" height="12" rx="3" fill="#60a5fa" opacity="0.7" />
        <rect x="2" y="18" width="12" height="12" rx="3" fill="#60a5fa" opacity="0.7" />
        <rect x="18" y="18" width="12" height="12" rx="3" fill="#3b82f6" />
      </svg>
      {showText && (
        <span style={{ fontWeight: 700, fontSize: textSize, letterSpacing: '-0.3px', color: 'var(--text)' }}>
          Dienste
        </span>
      )}
    </div>
  );
}

export default Logo;
