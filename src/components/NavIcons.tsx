import { useId } from 'react';
import type { CSSProperties, ReactNode } from 'react';

export interface NavIconProps { size?: number }

function NavIconFrame({ size = 26, children, className }: NavIconProps & { children: ReactNode; className: string }) {
  return <svg className={'nav-glyph ' + className} width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{children}</svg>;
}

/** A fixed book spine with a hinged cover and two independently turning leaves. */
export function SpeciesLibraryIcon({ size }: NavIconProps) {
  return <NavIconFrame size={size} className="nav-guide">
    <path className="nav-guide-back" d="M7 3.25h14.2a1.55 1.55 0 0 1 1.55 1.55v17.45H7a3.25 3.25 0 0 1-3.25-3.25V6.5A3.25 3.25 0 0 1 7 3.25Z" />
    <path d="M3.75 19a3.25 3.25 0 0 1 3.25-3.25h15.75M7 3.5v18.25" strokeOpacity=".65" />
    <path className="nav-guide-paper" d="M8.1 4.4h13.15v15.8H8.1Z" />
    <g className="nav-guide-print"><path d="M10.5 7.4h8M10.5 10.2h5.4M10.5 13h7.1M10.5 17.6h8" /><circle cx="18.6" cy="10.2" r=".75" /></g>
    <g className="nav-guide-leaf nav-guide-leaf-one"><path d="M7.4 4.5h13.4v16.4H7.4Z" /><path d="M10 8h7.8M10 11h6M10 14h7.8" /></g>
    <g className="nav-guide-leaf nav-guide-leaf-two"><path d="M7.4 4.2h13.8v17H7.4Z" /><path d="M10 7.8h8M10 10.8h5.2M10 13.8h8" /></g>
    <g className="nav-guide-cover">
      <path className="nav-guide-cover-face" d="M7.1 3.25h13.75A1.65 1.65 0 0 1 22.5 4.9v17.35H7.1Z" />
      <path className="nav-guide-profile" d="M10.4 13v-2.65A2.35 2.35 0 0 1 12.75 8h3.5l3 1.95v2.15h-3.8l-1.85 2.05h-2.45" />
      <circle className="nav-guide-eye" cx="15.8" cy="9.7" r=".65" stroke="none" />
      <path className="nav-guide-title" d="M10.6 17.7h8.4M10.6 19.5h5.7" />
    </g>
    <path className="nav-guide-spine" d="M7.1 3.5v18.4" />
  </NavIconFrame>;
}

/** Holographic specimen panels exchange two differently coloured data packets. */
export function CompareSpeciesIcon({ size }: NavIconProps) {
  return <NavIconFrame size={size} className="nav-compare">
    <g className="nav-compare-panel nav-compare-panel-left"><rect className="nav-compare-card" x="3.1" y="7.8" width="8" height="10.4" rx="1.7" /><path className="nav-compare-values nav-compare-values-left" d="M5.5 11.2h3.2m-3.2 3h2.2" /><path className="nav-compare-sheen" d="M4.3 9.2h5.6" /></g>
    <g className="nav-compare-panel nav-compare-panel-right"><rect className="nav-compare-card" x="14.9" y="7.8" width="8" height="10.4" rx="1.7" /><path className="nav-compare-values nav-compare-values-right" d="M17.3 11.2h3.2m-3.2 3h2.2" /><path className="nav-compare-sheen" d="M16.1 9.2h5.6" /></g>
    <path className="nav-compare-forward-track" d="M7.5 4.4h11m-2.3-2.3 2.3 2.3-2.3 2.3" />
    <path className="nav-compare-return-track" d="M18.5 21.6h-11m2.3-2.3-2.3 2.3 2.3 2.3" />
    <circle className="nav-compare-packet nav-compare-packet-forward nav-compare-trail" cx="7.5" cy="4.4" r=".55" stroke="none" />
    <circle className="nav-compare-packet nav-compare-packet-return nav-compare-trail" cx="18.5" cy="21.6" r=".55" stroke="none" />
    <circle className="nav-compare-packet nav-compare-packet-forward" cx="7.5" cy="4.4" r="1.05" stroke="none" />
    <circle className="nav-compare-packet nav-compare-packet-return" cx="18.5" cy="21.6" r="1.05" stroke="none" />
  </NavIconFrame>;
}

/** The table silhouette stays fixed while its bars grow and rows are scanned. */
export function SpeciesTableIcon({ size }: NavIconProps) {
  const clip = 'nav-table-' + useId().replaceAll(':', '');
  return <NavIconFrame size={size} className="nav-table">
    <defs><clipPath id={clip}><rect x="3.8" y="10.4" width="18.4" height="10.6" rx=".5" /></clipPath></defs>
    <rect className="nav-table-frame" x="3" y="4.25" width="20" height="17.5" rx="2.5" />
    <path className="nav-table-header" d="M5.5 4.25h15A2.5 2.5 0 0 1 23 6.75V10H3V6.75a2.5 2.5 0 0 1 2.5-2.5Z" stroke="none" />
    <g clipPath={'url(#' + clip + ')'}><rect className="nav-table-sweep" x="3.8" y="10.6" width="18.4" height="4.5" rx=".5" stroke="none" /></g>
    <path className="nav-table-grid" d="M3 10h20M3 15.75h20M10 4.5v17" />
    <path className="nav-table-value nav-table-value-one" d="M13.5 7.25h6" />
    <path className="nav-table-value nav-table-value-two" d="M13.5 12.75h6" />
    <path className="nav-table-value nav-table-value-three" d="M13.5 18.75h6" />
    <circle className="nav-table-status nav-table-status-one" cx="6.5" cy="12.85" r=".85" stroke="none" />
    <circle className="nav-table-status nav-table-status-two" cx="6.5" cy="18.75" r=".85" stroke="none" />
  </NavIconFrame>;
}

/** CSS morphs the two sine backbones through a complete turn. Bond projection
 * and endpoint depth follow the same phases; there is no JavaScript frame loop. */
export function MutationsIcon({ size }: NavIconProps) {
  return <NavIconFrame size={size} className="nav-dna">
    <g className="nav-dna-ghost"><path d="M19 3C19 4.111 17.814 5.222 16 6.333C14.186 7.444 11.814 8.556 10 9.667C8.186 10.778 7 11.889 7 13C7 14.111 8.186 15.222 10 16.333C11.814 17.444 14.186 18.556 16 19.667C17.814 20.778 19 21.889 19 23" /><path d="M7 3C7 4.111 8.186 5.222 10 6.333C11.814 7.444 14.186 8.556 16 9.667C17.814 10.778 19 11.889 19 13C19 14.111 17.814 15.222 16 16.333C14.186 17.444 11.814 18.556 10 19.667C8.186 20.778 7 21.889 7 23" /></g>
    <path className="nav-dna-backbone nav-dna-backbone-one" d="M19 3C19 4.111 17.814 5.222 16 6.333C14.186 7.444 11.814 8.556 10 9.667C8.186 10.778 7 11.889 7 13C7 14.111 8.186 15.222 10 16.333C11.814 17.444 14.186 18.556 16 19.667C17.814 20.778 19 21.889 19 23" />
    <path className="nav-dna-backbone nav-dna-backbone-two" d="M7 3C7 4.111 8.186 5.222 10 6.333C11.814 7.444 14.186 8.556 16 9.667C17.814 10.778 19 11.889 19 13C19 14.111 17.814 15.222 16 16.333C14.186 17.444 11.814 18.556 10 19.667C8.186 20.778 7 21.889 7 23" />
    {Array.from({length:7},(_,index)=>{
      const y=3+index*10/3,phase=index*Math.PI/3,rest=Number(Math.cos(phase).toFixed(5));
      const style={'--dna-phase-a':(-index*.8)+'s','--dna-phase-b':(-index*.8-2.4)+'s','--dna-bond':index%2?'#ffcb65':'#c7fa67','--dna-rest-a':(rest*6)+'px','--dna-rest-b':(-rest*6)+'px','--dna-rest-rung':rest,'--dna-origin':'13px '+y+'px'} as CSSProperties;
      return <g className="nav-dna-level" key={index} style={style}><path className="nav-dna-rung" d={'M7 '+y+'H19'} /><circle className="nav-dna-orbit nav-dna-orbit-one" cx="13" cy={y} r=".95" stroke="none" /><circle className="nav-dna-orbit nav-dna-orbit-two" cx="13" cy={y} r=".95" stroke="none" /></g>;
    })}
  </NavIconFrame>;
}

/** A fixed glass silhouette with continuously active liquid and rising bubbles. */
export function AnimatedFlaskIcon({ size = 33 }: NavIconProps) {
  const clip = 'nav-flask-' + useId().replaceAll(':', '');
  return <NavIconFrame size={size} className="nav-flask">
    <defs><clipPath id={clip}><path d="M10.8 4v6.5L5.6 19.8A1.45 1.45 0 0 0 6.8 22h12.4a1.45 1.45 0 0 0 1.2-2.2l-5.2-9.3V4Z" /></clipPath></defs>
    <circle className="nav-flask-halo" cx="13" cy="14" r="10.6" strokeWidth=".7" />
    <g clipPath={'url(#' + clip + ')'}>
      <g className="nav-flask-liquid"><path d="M2 16Q5 13.9 8 16t6 0 6 0 6 0v9H2Z" fill="currentColor" fillOpacity=".34" stroke="none" /><path className="nav-flask-surface" d="M2 16Q5 13.9 8 16t6 0 6 0 6 0" strokeWidth="1" /></g>
      <circle className="nav-flask-bubble nav-flask-bubble-one" cx="10" cy="20.5" r="1" strokeWidth=".8" />
      <circle className="nav-flask-bubble nav-flask-bubble-two" cx="15" cy="21" r=".8" strokeWidth=".75" />
      <circle className="nav-flask-bubble nav-flask-bubble-three" cx="17" cy="19.5" r=".7" strokeWidth=".7" />
    </g>
    <path d="M9 3h8M10 3v7L4.8 19.3A2.2 2.2 0 0 0 6.7 22.6h12.6a2.2 2.2 0 0 0 1.9-3.3L16 10V3" strokeWidth="1.55" />
    <path className="nav-flask-glint" d="M12.6 5.3v3.4M7.5 19.1l1.1-2" strokeWidth=".85" />
  </NavIconFrame>;
}
