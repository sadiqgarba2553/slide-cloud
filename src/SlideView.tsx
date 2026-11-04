import type { Slide, SlideElement } from './model';
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
        const chartH = e.h - 50;
        const chartW = e.w - 40;
        const barColors = ['#CF551D', '#E27E3F', '#F4A66B', '#D06E35', '#B84D19'];

        return (
          <g>
            <rect width={e.w} height={e.h} rx={6} fill={e.fill || '#FFFFFF'} stroke={e.stroke || '#E8DEC8'} strokeWidth={1} />
            <text x={20} y={26} fontFamily="Arial, sans-serif" fontSize={14} fontWeight="bold" fill="#202420">
              {e.chartTitle || 'Chart'}
            </text>

            {e.chartType === 'line' ? (
              <g transform="translate(30, 40)">
                <line x1={0} y1={chartH} x2={chartW} y2={chartH} stroke="#CCD0CC" strokeWidth={1.5} />
                <polyline
                  fill="none"
                  stroke="#CF551D"
                  strokeWidth={3}
                  points={data
                    .map((d, i) => {
                      const px = (i / Math.max(1, data.length - 1)) * (chartW - 20) + 10;
                      const py = chartH - (d.value / maxVal) * (chartH - 20);
                      return `${px},${py}`;
                    })
                    .join(' ')}
                />
                {data.map((d, i) => {
                  const px = (i / Math.max(1, data.length - 1)) * (chartW - 20) + 10;
                  const py = chartH - (d.value / maxVal) * (chartH - 20);
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
                  const barW = Math.max(12, (chartW - 20) / data.length - 12);
                  const barH = (d.value / maxVal) * (chartH - 25);
                  const bx = 16 + i * (barW + 12);
                  const by = chartH - barH;
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
}: {
  slide: Slide;
  className?: string;
  label?: string;
}) {
  return (
    <svg className={className} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label || 'Slide preview'}>
      <rect width={WIDTH} height={HEIGHT} fill={slide.background} />
      {slide.elements.map(e => (
        <ElementView key={e.id} element={e} />
      ))}
    </svg>
  );
}
