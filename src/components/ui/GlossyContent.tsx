import React from 'react';

interface GlossyContentProps {
  icon?: React.ReactNode;
  children?: React.ReactNode;
  /** Content rendered after the label, outside the text-clip span (e.g. a count badge). */
  trailing?: React.ReactNode;
  /** Tighter padding for small icon-only buttons (circular "x", chip remove, etc). */
  compact?: boolean;
  /** How icon/label/trailing are distributed inside the pill. Defaults to centered. */
  justify?: 'center' | 'flex-start' | 'space-between';
}

// The nested outer/inner/span structure the glossy-btn skin (buttonGlossy.css)
// expects. The icon and any trailing content sit outside the text span so the
// gradient text-clip only ever applies to the label, never to icon glyphs.
const GlossyContent: React.FC<GlossyContentProps> = ({ icon, children, trailing, compact, justify }) => (
  <span className="glossy-outer">
    <span
      className="glossy-inner"
      style={{
        ...(compact ? { padding: '0.55em 1em' } : null),
        ...(justify ? { justifyContent: justify } : null),
        ...(justify && justify !== 'center' ? { width: '100%' } : null),
      }}
    >
      {icon}
      {children != null && <span className="glossy-label">{children}</span>}
      {trailing}
    </span>
  </span>
);

export default GlossyContent;
