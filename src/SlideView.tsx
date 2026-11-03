import type { Slide, SlideElement } from './model';
import { WIDTH, HEIGHT } from './model';

export function ElementView({ element: e }: { element: SlideElement }) {
  const paint = { fill: e.fill || 'none', stroke: e.stroke || 'none', strokeWidth: e.strokeWidth || 0 };
  return <g transform={`translate(${e.x},${e.y}) rotate(${e.rotation || 0},${e.w / 2},${e.h / 2})`}>
    {e.type === 'rect' && <rect width={e.w} height={e.h} {...paint}/>}
    {e.type === 'ellipse' && <ellipse cx={e.w/2} cy={e.h/2} rx={e.w/2} ry={e.h/2} {...paint}/>}
    {e.type === 'line' && <line x1={0} y1={0} x2={e.w} y2={e.h} stroke={e.stroke || e.color || '#222222'} strokeWidth={e.strokeWidth || 3}/>}
    {e.type === 'image' && e.src && <image href={e.src} width={e.w} height={e.h} preserveAspectRatio="xMidYMid meet"/>}
    {e.type === 'text' && <foreignObject width={e.w} height={e.h}><div style={{ color: e.color || '#1d1d1f', fontSize: e.fontSize || 28, fontFamily: e.fontFamily || 'Arial', fontWeight: e.bold ? 700 : 400, fontStyle: e.italic ? 'italic' : 'normal', textAlign: e.align || 'left', lineHeight: 1.2, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', width: '100%', height: '100%', overflow: 'hidden' }}>{e.text || ''}</div></foreignObject>}
  </g>;
}
export function SlideView({ slide, className = '', label = '' }: { slide: Slide; className?: string; label?: string }) {
  return <svg className={className} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label || 'Slide preview'}><rect width={WIDTH} height={HEIGHT} fill={slide.background}/>{slide.elements.map(e => <ElementView key={e.id} element={e}/>)}</svg>;
}
