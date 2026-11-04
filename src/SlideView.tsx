import type { Slide, SlideElement } from './model';
import type { CSSProperties } from 'react';
import { WIDTH, HEIGHT } from './model';

export function ElementView({ element: e }: { element: SlideElement }) {
  const paint = {
    fill: e.fill || 'none',
    stroke: e.stroke || 'none',
    strokeWidth: e.strokeWidth || 0,
    opacity: e.opacity !== undefined ? e.opacity : 1,
  };

  return (
    <g transform={`translate(${e.x},${e.y}) rotate(${e.rotation || 0},${e.w / 2},${e.h / 2})`}>
      {/* 1. Rectangle */}
      {e.type === 'rect' && <rect width={e.w} height={e.h} rx={4} {...paint} />}

      {/* 2. Ellipse */}
      {e.type === 'ellipse' && <ellipse cx={e.w / 2} cy={e.h / 2} rx={e.w / 2} ry={e.h / 2} {...paint} />}

      {/* 3. Line */}
      {e.type === 'line' && (
        <line x1={0} y1={0} x2={e.w} y2={e.h} stroke={e.stroke || e.color || '#222222'} strokeWidth={e.strokeWidth || 3} />
      )}

      {/* 4. Triangle */}
      {e.type === 'triangle' && (
        <polygon points={`${e.w / 2},0 ${e.w},${e.h} 0,${e.h}`} {...paint} />
      )}

      {/* 5. Diamond */}
      {e.type === 'diamond' && (
        <polygon points={`${e.w / 2},0 ${e.w},${e.h / 2} ${e.w / 2},${e.h} 0,${e.h / 2}`} {...paint} />
      )}

      {/* 6. Star */}
      {e.type === 'star' && (() => {
        const cx = e.w / 2;
        const cy = e.h / 2;
        const rOuter = Math.min(e.w, e.h) / 2;
        const rInner = rOuter * 0.4;
        const pts: string[] = [];
        for (let i = 0; i < 10; i++) {
          const angle = (i * Math.PI) / 5 - Math.PI / 2;
          const r = i % 2 === 0 ? rOuter : rInner;
          pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
        }
        return <polygon points={pts.join(' ')} {...paint} />;
      })()}

      {/* 7. Image */}
      {e.type === 'image' && e.src && <image href={e.src} width={e.w} height={e.h} preserveAspectRatio="xMidYMid meet" />}

      {/* 8. Text */}
      {e.type === 'text' && (
        <foreignObject width={e.w} height={e.h}>
          <div
            style={{
              color: e.color || '#1d1d1f',
              fontSize: e.fontSize || 28,
              fontFamily: e.fontFamily || 'Arial',
              fontWeight: e.bold ? 700 : 400,
              fontStyle: e.italic ? 'italic' : 'normal',
              textAlign: e.align || 'left',
              lineHeight: 1.25,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              width: '100%',
              height: '100%',
              overflow: 'hidden',
            }}
          >
            {e.text || ''}
          </div>
        </foreignObject>
      )}

      {/* 9. Table */}
      {e.type === 'table' && (() => {
        const rows = e.tableRows || 3;
        const cols = e.tableCols || 3;
        const cellW = e.w / cols;
        const cellH = e.h / rows;
        return (
          <g>
            <rect width={e.w} height={e.h} rx={2} fill={e.fill || '#FFFFFF'} stroke={e.stroke || '#D9C8BC'} strokeWidth={1} />
            {Array.from({ length: rows - 1 }).map((_, r) => (
              <line key={`r-${r}`} x1={0} y1={(r + 1) * cellH} x2={e.w} y2={(r + 1) * cellH} stroke={e.stroke || '#D9C8BC'} strokeWidth={1} opacity={0.6} />
            ))}
            {Array.from({ length: cols - 1 }).map((_, c) => (
              <line key={`c-${c}`} x1={(c + 1) * cellW} y1={0} x2={(c + 1) * cellW} y2={e.h} stroke={e.stroke || '#D9C8BC'} strokeWidth={1} opacity={0.6} />
            ))}
            {e.tableData?.map((row, ri) =>
              row.map((cellText, ci) => (
                <text
                  key={`cell-${ri}-${ci}`}
                  x={ci * cellW + 8}
                  y={ri * cellH + cellH * 0.6}
                  fontFamily="Arial, sans-serif"
                  fontSize={Math.max(10, Math.min(16, cellH * 0.35))}
                  fontWeight={ri === 0 ? 'bold' : 'normal'}
                  fill="#202420"
                >
                  {cellText.slice(0, 25)}
                </text>
              ))
            )}
          </g>
        );
      })()}

      {/* 10. Chart */}
      {e.type === 'chart' && (() => {
        const data = e.chartData || [
          { label: 'Q1', value: 30 },
          { label: 'Q2', value: 50 },
          { label: 'Q3', value: 40 },
          { label: 'Q4', value: 70 },
        ];
        const maxVal = Math.max(1, ...data.map(d => Math.abs(d.value)));
        const minVal = Math.min(0, ...data.map(d => d.value));
        const highVal = Math.max(1, ...data.map(d => d.value));
        const chartH = Math.max(1, e.h - 70);
        const chartW = Math.max(1, e.w - 55);
        const yFor = (value: number) => chartH - (value - minVal) / (highVal - minVal) * (chartH - 20);
        const zeroY = yFor(0);
        const barColors = ['#CF551D', '#E27E3F', '#F4A66B', '#D06E35', '#B84D19'];

        return (
          <g>
            <rect width={e.w} height={e.h} rx={6} fill={e.fill || '#FFFFFF'} stroke={e.stroke || '#E8DEC8'} strokeWidth={1} />
            <text x={20} y={26} fontFamily="Arial, sans-serif" fontSize={14} fontWeight="bold" fill="#202420">
              {e.chartTitle || 'Chart'}
            </text>

            {e.chartType === 'pie' ? (() => {
              const total = data.reduce((sum, p) => sum + Math.max(0, p.value), 0);
              let angle = -Math.PI / 2;
              const radius = Math.max(1, Math.min(chartW, chartH) / 2 - 5), cx = e.w / 2, cy = 40 + chartH / 2;
              return data.map((p, i) => {
                const fraction = total ? Math.max(0, p.value) / total : 0;
                const end = angle + fraction * Math.PI * 2;
                const path = `M ${cx} ${cy} L ${cx + radius * Math.cos(angle)} ${cy + radius * Math.sin(angle)} A ${radius} ${radius} 0 ${fraction > .5 ? 1 : 0} 1 ${cx + radius * Math.cos(end)} ${cy + radius * Math.sin(end)} Z`;
                angle = end;
                return fraction >= 1 ? <circle key={i} cx={cx} cy={cy} r={radius} fill={barColors[i % barColors.length]}><title>{p.label}: {p.value}</title></circle> : <path key={i} d={path} fill={barColors[i % barColors.length]}><title>{p.label}: {p.value}</title></path>;
              });
            })() : e.chartType === 'line' ? (
              <g transform="translate(30, 40)">
                <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="#CCD0CC" strokeWidth={1.5} />
                <polyline
                  fill="none"
                  stroke="#CF551D"
                  strokeWidth={3}
                  points={data
                    .map((d, i) => {
                      const px = (i / Math.max(1, data.length - 1)) * (chartW - 20) + 10;
                      const py = yFor(d.value);
                      return `${px},${py}`;
                    })
                    .join(' ')}
                />
                {data.map((d, i) => {
                  const px = (i / Math.max(1, data.length - 1)) * (chartW - 20) + 10;
                  const py = yFor(d.value);
                  return (
                    <g key={i}>
                      <circle cx={px} cy={py} r={4} fill="#CF551D" />
                      <text x={px} y={chartH + 16} textAnchor="middle" fontSize={10} fill="#666">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            ) : (
              <g transform="translate(25, 35)">
                <line x1={10} y1={chartH} x2={chartW + 10} y2={chartH} stroke="#CCD0CC" strokeWidth={1.5} />
                {data.map((d, i) => {
                  const band = (chartW - 20) / Math.max(1, data.length);
                  const barW = Math.max(.1, band * .7);
                  const barH = Math.abs(yFor(d.value) - zeroY);
                  const bx = 16 + i * band;
                  const by = Math.min(zeroY, yFor(d.value));
                  return (
                    <g key={i}>
                      <rect x={bx} y={by} width={barW} height={barH} rx={3} fill={barColors[i % barColors.length]} />
                      <text x={bx + barW / 2} y={by - 5} textAnchor="middle" fontSize={9} fill="#333">
                        {d.value}
                      </text>
                      <text x={bx + barW / 2} y={chartH + 16} textAnchor="middle" fontSize={10} fill="#666">
                        {d.label}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}
          </g>
        );
      })()}
    </g>
  );
}

export function SlideView({
  slide,
  className = '',
  label = '',
  animate = false,
}: {
  slide: Slide;
  className?: string;
  label?: string;
  animate?: boolean;
}) {
  return (
    <svg key={slide.id} className={`${className} ${animate ? 'slide-playback' : ''}`} data-transition={animate ? slide.transition?.type : undefined} style={animate ? { '--slide-duration': `${slide.transition?.duration || 0.5}s` } as CSSProperties : undefined} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label || 'Slide preview'}>
      <rect width={WIDTH} height={HEIGHT} fill={slide.background} />
      {slide.elements.map(e => (
        <g key={e.id} data-effect={animate ? e.animation?.type : undefined} style={animate ? { '--effect-duration': `${e.animation?.duration || 0.5}s`, '--effect-delay': `${(slide.transition?.type && slide.transition.type !== 'none' ? slide.transition.duration : 0) + Math.min(100, e.animation?.order || 0) * 0.15}s` } as CSSProperties : undefined}><ElementView element={e} /></g>
      ))}
    </svg>
  );
}
