export const WIDTH = 960;
export const HEIGHT = 540;
export const MAX_SLIDES = 200;
export const MAX_ELEMENTS = 300;

export type ElementType =
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'image'
  | 'triangle'
  | 'star'
  | 'diamond'
  | 'table'
  | 'chart';

export interface ChartDataPoint {
  label: string;
  value: number;
}

export interface SlideElement {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  text?: string;
  fontSize?: number;
  fontFamily?: string;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  color?: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  src?: string;
  locked?: boolean;
  opacity?: number;
  // Table properties
  tableRows?: number;
  tableCols?: number;
  tableData?: string[][];
  // Chart properties
  chartType?: 'bar' | 'line' | 'pie';
  chartTitle?: string;
  chartData?: ChartDataPoint[];
  // Animation effect
  animation?: {
    type: 'none' | 'fade-in' | 'fly-in-bottom' | 'fly-in-left' | 'zoom-in';
    duration: number;
    order: number;
  };
}

export interface SlideTransition {
  type: 'none' | 'fade' | 'slide-left' | 'slide-right' | 'zoom';
  duration: number;
}

export interface Slide {
  id: string;
  background: string;
  notes: string;
  elements: SlideElement[];
  layout?: 'blank' | 'title' | 'title-body' | 'two-column' | 'section-header';
  transition?: SlideTransition;
}

export interface DeckVersion {
  id: string;
  name: string;
  at: string;
  slides: Slide[];
}

export interface Deck {
  format: 'slide-cloud';
  formatVersion: 1;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  slides: Slide[];
  versions: DeckVersion[];
  importWarnings?: string[];
}

const uid = () => crypto.randomUUID();

export function newElement(type: ElementType): SlideElement {
  const base = {
    id: uid(),
    type,
    x: 80,
    y: 100,
    w: type === 'line' ? 300 : type === 'table' ? 480 : type === 'chart' ? 440 : 400,
    h: type === 'text' ? 100 : type === 'line' ? 2 : type === 'table' ? 220 : type === 'chart' ? 260 : 200,
    rotation: 0,
    locked: false,
  };

  switch (type) {
    case 'text':
      return {
        ...base,
        text: 'Your next idea',
        fontSize: 36,
        fontFamily: 'Arial',
        color: '#202420',
        align: 'left',
        bold: false,
        italic: false,
      };
    case 'line':
      return { ...base, stroke: '#C75719', strokeWidth: 3, fill: 'transparent' };
    case 'table':
      return {
        ...base,
        fill: '#FFFFFF',
        stroke: '#C75719',
        strokeWidth: 1,
        tableRows: 3,
        tableCols: 3,
        tableData: [
          ['Header 1', 'Header 2', 'Header 3'],
          ['Data A', 'Data B', 'Data C'],
          ['Data D', 'Data E', 'Data F'],
        ],
      };
    case 'chart':
      return {
        ...base,
        fill: '#FFFFFF',
        stroke: '#C75719',
        strokeWidth: 1,
        chartType: 'bar',
        chartTitle: 'Performance by Quarter',
        chartData: [
          { label: 'Q1', value: 35 },
          { label: 'Q2', value: 58 },
          { label: 'Q3', value: 42 },
          { label: 'Q4', value: 75 },
        ],
      };
    case 'triangle':
    case 'star':
    case 'diamond':
    case 'ellipse':
    case 'rect':
    default:
      return { ...base, fill: '#FF914D', stroke: '#C75719', strokeWidth: 0 };
  }
}

export function newSlide(): Slide {
  return {
    id: uid(),
    background: '#FFFFFF',
    notes: '',
    elements: [],
    layout: 'blank',
    transition: { type: 'none', duration: 0.5 },
  };
}

export function newDeck(name = 'Untitled presentation'): Deck {
  const now = new Date().toISOString();
  return {
    format: 'slide-cloud',
    formatVersion: 1,
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    slides: [newSlide()],
    versions: [],
  };
}

const color = (value: unknown): value is string =>
  typeof value === 'string' && (/^#[\da-f]{6}$/i.test(value) || value === 'transparent' || value.startsWith('rgba('));

function string(value: unknown, limit: number, label: string): string {
  if (typeof value !== 'string' || value.length > limit) throw Error(`Invalid ${label}`);
  return value;
}

function number(value: unknown, min: number, max: number, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max)
    throw Error(`Invalid ${label}`);
  return value;
}

export function validImage(source: unknown): source is string {
  return (
    typeof source === 'string' &&
    source.length <= 12 * 1024 * 1024 &&
    /^data:image\/(png|jpeg|gif|webp);base64,[A-Za-z\d+/]+={0,2}$/.test(source)
  );
}

function parseElement(value: unknown): SlideElement {
  if (!value || typeof value !== 'object') throw Error('Invalid slide element');
  const e = value as Record<string, unknown>;
  const validTypes = ['text', 'rect', 'ellipse', 'line', 'image', 'triangle', 'star', 'diamond', 'table', 'chart'];
  if (!validTypes.includes(String(e.type))) throw Error('Unsupported slide element');

  const result: SlideElement = {
    id: string(e.id, 100, 'element id'),
    type: e.type as ElementType,
    x: number(e.x, -WIDTH * 4, WIDTH * 4, 'element position'),
    y: number(e.y, -HEIGHT * 4, HEIGHT * 4, 'element position'),
    w: number(e.w, 1, WIDTH * 4, 'element width'),
    h: number(e.h, 1, HEIGHT * 4, 'element height'),
  };

  if (e.rotation !== undefined) result.rotation = number(e.rotation, -360, 360, 'rotation');
  if (e.text !== undefined) result.text = string(e.text, 50000, 'element text');
  if (e.fontSize !== undefined) result.fontSize = number(e.fontSize, 6, 300, 'font size');
  if (e.fontFamily !== undefined) result.fontFamily = string(e.fontFamily, 100, 'font family');

  for (const key of ['bold', 'italic'] as const) {
    if (e[key] !== undefined) {
      if (typeof e[key] !== 'boolean') throw Error('Invalid text style');
      result[key] = e[key];
    }
  }

  if (e.align !== undefined) {
    if (!['left', 'center', 'right'].includes(String(e.align))) throw Error('Invalid text alignment');
    result.align = e.align as SlideElement['align'];
  }

  for (const key of ['color', 'fill', 'stroke'] as const) {
    if (e[key] !== undefined) {
      if (!color(e[key])) throw Error('Invalid element color');
      result[key] = e[key];
    }
  }

  if (e.strokeWidth !== undefined) result.strokeWidth = number(e.strokeWidth, 0, 40, 'stroke width');
  if (e.locked !== undefined) result.locked = Boolean(e.locked);
  if (e.opacity !== undefined) result.opacity = number(e.opacity, 0, 1, 'opacity');

  if (result.type === 'image') {
    if (!validImage(e.src)) throw Error('Only embedded PNG, JPEG, GIF and WebP images are supported');
    result.src = e.src;
  }

  // Table support
  if (result.type === 'table') {
    result.tableRows = typeof e.tableRows === 'number' && Number.isFinite(e.tableRows) ? Math.max(1, Math.min(30, Math.floor(e.tableRows))) : 3;
    result.tableCols = typeof e.tableCols === 'number' && Number.isFinite(e.tableCols) ? Math.max(1, Math.min(20, Math.floor(e.tableCols))) : 3;
    result.tableData = Array.isArray(e.tableData)
      ? (e.tableData as string[][]).slice(0, result.tableRows).map(row => Array.isArray(row) ? row.slice(0, result.tableCols).map(c => String(c).slice(0, 1000)) : [])
      : Array.from({ length: result.tableRows }, () => Array.from({ length: result.tableCols! }, () => ''));
  }

  // Chart support
  if (result.type === 'chart') {
    result.chartType = ['bar', 'line', 'pie'].includes(String(e.chartType))
      ? (e.chartType as 'bar' | 'line' | 'pie')
      : 'bar';
    result.chartTitle = typeof e.chartTitle === 'string' ? e.chartTitle.slice(0, 200) : 'Chart';
    result.chartData = Array.isArray(e.chartData)
      ? (e.chartData as ChartDataPoint[]).slice(0, 1000).map(pt => ({
          label: String(pt?.label || '').slice(0, 100),
          value: number(pt?.value, -1e15, 1e15, 'chart value'),
        }))
      : [
          { label: 'Q1', value: 35 },
          { label: 'Q2', value: 58 },
          { label: 'Q3', value: 42 },
          { label: 'Q4', value: 75 },
        ];
  }

  // Animation support
  if (e.animation && typeof e.animation === 'object') {
    const anim = e.animation as Record<string, unknown>;
    result.animation = {
      type: ['none', 'fade-in', 'fly-in-bottom', 'fly-in-left', 'zoom-in'].includes(String(anim.type))
        ? (anim.type as any)
        : 'none',
      duration: typeof anim.duration === 'number' ? Math.max(0.1, Math.min(10, anim.duration)) : 0.5,
      order: typeof anim.order === 'number' ? Math.max(0, anim.order) : 0,
    };
  }

  return result;
}

function parseSlides(value: unknown): Slide[] {
  if (!Array.isArray(value) || !value.length || value.length > MAX_SLIDES)
    throw Error(`Presentations require 1–${MAX_SLIDES} slides`);
  const slideIds = new Set<string>();
  let total = 0;

  return value.map(s => {
    if (
      !s ||
      typeof s !== 'object' ||
      !color(s.background) ||
      s.background === 'transparent' ||
      !Array.isArray(s.elements) ||
      s.elements.length > MAX_ELEMENTS
    )
      throw Error('Invalid slide');

    const id = string(s.id, 100, 'slide id');
    if (!id || slideIds.has(id)) throw Error('Duplicate slide id');
    slideIds.add(id);

    total += s.elements.length;
    if (total > 10000) throw Error('Too many elements in this presentation');

    const elements = s.elements.map(parseElement);
    const elementIds = new Set<string>();
    for (const e of elements) {
      if (!e.id || elementIds.has(e.id)) throw Error('Duplicate element id');
      elementIds.add(e.id);
    }

    const slideObj: Slide = {
      id,
      background: s.background,
      notes: string(s.notes, 100000, 'speaker notes'),
      elements,
    };

    if (s.layout && typeof s.layout === 'string') {
      slideObj.layout = s.layout as Slide['layout'];
    }

    if (s.transition && typeof s.transition === 'object') {
      const trans = s.transition as Record<string, unknown>;
      slideObj.transition = {
        type: ['none', 'fade', 'slide-left', 'slide-right', 'zoom'].includes(String(trans.type))
          ? (trans.type as any)
          : 'none',
        duration: typeof trans.duration === 'number' ? Math.max(0.1, Math.min(10, trans.duration)) : 0.5,
      };
    }

    return slideObj;
  });
}

export function parseNative(text: string): Deck {
  if (text.length > 32 * 1024 * 1024) throw Error('Presentation exceeds the 32 MB native-format limit');
  const value = JSON.parse(text, (key, item) => {
    if (['__proto__', 'prototype', 'constructor'].includes(key)) throw Error('Unsafe presentation property');
    return item;
  });

  if (!value || value.format !== 'slide-cloud' || value.formatVersion !== 1)
    throw Error('Unsupported Slide Cloud file version');

  const deck: Deck = {
    format: 'slide-cloud',
    formatVersion: 1,
    id: string(value.id, 100, 'presentation id'),
    name: string(value.name, 240, 'presentation name'),
    createdAt: string(value.createdAt, 40, 'creation date'),
    updatedAt: string(value.updatedAt, 40, 'updated date'),
    slides: parseSlides(value.slides),
    versions: [],
  };

  if (value.versions !== undefined) {
    if (!Array.isArray(value.versions) || value.versions.length > 30) throw Error('Too many saved versions');
    deck.versions = value.versions.map((v: DeckVersion) => ({
      id: string(v.id, 100, 'version id'),
      name: string(v.name, 240, 'version name'),
      at: string(v.at, 40, 'version date'),
      slides: parseSlides(v.slides),
    }));
  }

  if (value.importWarnings !== undefined) {
    if (!Array.isArray(value.importWarnings) || value.importWarnings.length > 50) throw Error('Invalid import warnings');
    deck.importWarnings = value.importWarnings.map((w: unknown) => string(w, 500, 'import warning'));
  }

  return deck;
}

export function serializeNative(deck: Deck): string {
  let contentSize = 0;
  for (const slides of [deck.slides, ...(deck.versions || []).map(v => v.slides)]) {
    for (const slide of slides) {
      contentSize += slide.notes.length;
      for (const element of slide.elements) {
        contentSize += (element.src?.length || 0) + (element.text?.length || 0);
      }
      if (contentSize > 30 * 1024 * 1024) throw Error('Presentation content exceeds the native-format size limit');
    }
  }
  const text = JSON.stringify(deck);
  parseNative(text);
  return text;
}

export const TEMPLATES = [
  { id: 'pitch', name: 'A new idea', description: 'A considered introduction to your next venture.' },
  { id: 'project', name: 'Project update', description: 'Bring the team together around what matters.' },
  { id: 'lesson', name: 'Share what you know', description: 'Give your ideas a clear, engaging structure.' },
] as const;

function text(
  content: string,
  x: number,
  y: number,
  w: number,
  h: number,
  size: number,
  color = '#202420',
  bold = false
): SlideElement {
  return { ...newElement('text'), text: content, x, y, w, h, fontSize: size, color, bold };
}

function rect(x: number, y: number, w: number, h: number, fill: string): SlideElement {
  return { ...newElement('rect'), x, y, w, h, fill, strokeWidth: 0 };
}

function page(background: string, elements: SlideElement[], notes = ''): Slide {
  return { ...newSlide(), background, elements, notes };
}

export function templateDeck(templateId: string): Deck {
  const template = TEMPLATES.find(t => t.id === templateId);
  if (!template) throw Error('Unknown presentation template');
  const deck = newDeck(template.name);

  if (templateId === 'pitch') {
    deck.slides = [
      page(
        '#FFF8F2',
        [
          rect(64, 62, 62, 6, '#D65E22'),
          text('YOUR NEXT CHAPTER', 64, 100, 700, 32, 16, '#A94B20', true),
          text('A new idea.\nA clear direction.', 64, 166, 820, 210, 64, '#252B27', true),
          text('A short introduction to what you are building.', 64, 422, 780, 48, 24),
        ],
        'Introduce your idea in one clear sentence.'
      ),
      page(
        '#FFFFFF',
        [
          text('01  /  THE OPPORTUNITY', 64, 52, 800, 32, 16, '#A94B20', true),
          text('Start with a real need.', 64, 125, 820, 90, 52, '#252B27', true),
          text('Who are you helping?\nWhat gets in their way?\nWhy does it matter now?', 64, 264, 820, 180, 30),
        ],
        'Describe the people and the problem. Replace the prompts with your own research.'
      ),
      page(
        '#FFFFFF',
        [
          text('02  /  THE APPROACH', 64, 52, 800, 32, 16, '#A94B20', true),
          text('Make the next step simpler.', 64, 120, 820, 90, 48, '#252B27', true),
          rect(64, 267, 248, 128, '#FFF0E4'),
          rect(356, 267, 248, 128, '#FFF0E4'),
          rect(648, 267, 248, 128, '#FFF0E4'),
          text('Understand', 84, 308, 210, 50, 28, '#A94B20', true),
          text('Build', 376, 308, 210, 50, 28, '#A94B20', true),
          text('Improve', 668, 308, 210, 50, 28, '#A94B20', true),
        ],
        'Explain the approach with concrete examples.'
      ),
      page('#252B27', [
        text('LET’S TALK', 64, 72, 820, 34, 16, '#FFB483', true),
        text('What comes next?', 64, 173, 820, 120, 64, '#FFFFFF', true),
        text('Add your next steps and contact details here.', 64, 374, 820, 70, 28, '#F4F4EE'),
      ]),
    ];
  }

  if (templateId === 'project') {
    deck.slides = [
      page('#F5F7F6', [
        text('PROJECT UPDATE', 64, 60, 800, 32, 16, '#346151', true),
        text('Progress, with\nperspective.', 64, 143, 820, 200, 64, '#203E33', true),
        rect(64, 408, 832, 2, '#C9D7D0'),
        text('Project name  /  Team  /  Date', 64, 445, 820, 40, 22, '#466454'),
      ]),
      page('#FFFFFF', [
        text('WHERE WE ARE', 64, 52, 820, 32, 16, '#346151', true),
        text('A shared view of the work.', 64, 120, 820, 90, 48, '#203E33', true),
        text('Completed\nAdd the work delivered since our last update.', 64, 250, 390, 160, 28),
        text('In progress\nAdd current priorities and any decisions needed.', 504, 250, 390, 160, 28),
      ]),
      page('#FFFFFF', [
        text('WHAT NEEDS ATTENTION', 64, 52, 820, 32, 16, '#346151', true),
        text('Keep the important things visible.', 64, 116, 820, 124, 46, '#203E33', true),
        rect(64, 290, 8, 148, '#386D56'),
        text('Decision\nWhat do we need to agree on?\nOwner and next check-in', 100, 286, 780, 160, 28),
      ]),
      page('#203E33', [
        text('NEXT STEPS', 64, 70, 820, 32, 16, '#B9DDC9', true),
        text('A practical path forward.', 64, 166, 820, 140, 58, '#FFFFFF', true),
        text('01  Priority\n02  Owner\n03  Next milestone', 64, 335, 820, 144, 28, '#E6F0EA'),
      ]),
    ];
  }

  if (templateId === 'lesson') {
    deck.slides = [
      page('#F7F5FA', [
        text('A LITTLE KNOWLEDGE GOES A LONG WAY', 64, 60, 832, 36, 16, '#6B5185', true),
        text('Share what\nyou know.', 64, 155, 820, 200, 68, '#342B43', true),
        text('Topic  /  Presenter  /  Date', 64, 434, 820, 40, 24, '#6B607B'),
      ]),
      page('#FFFFFF', [
        text('THE BIG QUESTION', 64, 52, 832, 32, 16, '#6B5185', true),
        text('What are we here to discover?', 64, 132, 820, 150, 54, '#342B43', true),
        text('Start with a question your audience can relate to.', 64, 356, 820, 90, 30),
      ]),
      page('#FFFFFF', [
        text('THREE IDEAS TO TAKE AWAY', 64, 52, 832, 32, 16, '#6B5185', true),
        rect(64, 140, 832, 86, '#F2EEF7'),
        rect(64, 250, 832, 86, '#F2EEF7'),
        rect(64, 360, 832, 86, '#F2EEF7'),
        text('01   The essential idea', 90, 161, 780, 50, 30),
        text('02   An example that makes it real', 90, 271, 780, 50, 30),
        text('03   A way to put it into practice', 90, 381, 780, 50, 30),
      ]),
      page('#342B43', [
        text('TRY IT YOURSELF', 64, 72, 832, 32, 16, '#D5BDEB', true),
        text('Make space\nfor questions.', 64, 164, 820, 190, 64, '#FFFFFF', true),
        text('Add a short exercise or discussion prompt.', 64, 430, 820, 60, 26, '#EEE5F7'),
      ]),
    ];
  }

  return deck;
}
