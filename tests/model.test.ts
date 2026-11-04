import { describe, expect, it } from 'vitest';
import JSZip from 'jszip';
import { HEIGHT, WIDTH, newDeck, newElement, newSlide, parseNative, serializeNative, templateDeck } from '../src/model';
import { exportPptx, importPptx } from '../src/exchange';

describe('presentation integrity', () => {
  it('creates independent decks, slides and editable template content', () => {
    const a = newDeck(), b = newDeck(); expect(a.id).not.toBe(b.id); expect(a.slides[0].id).not.toBe(b.slides[0].id);
    for (const id of ['pitch', 'project', 'lesson']) {
      const deck = templateDeck(id); expect(deck.slides.length).toBeGreaterThan(1);
      expect(deck.slides[0].elements.some(e => e.type === 'text' && e.text)).toBe(true);
      expect(parseNative(serializeNative(deck))).toEqual(deck);
    }
  });
  it('preserves notes, geometry, image bytes, slide order and named versions', () => {
    const deck = templateDeck('pitch'); deck.slides[0].notes = 'Speaker notes\nSecond line';
    deck.slides[0].elements.push({ ...newElement('image'), src: 'data:image/png;base64,iVBORw0KGgo=' });
    deck.versions.push({ id: 'v1', name: 'First version', at: new Date().toISOString(), slides: structuredClone(deck.slides) });
    expect(parseNative(serializeNative(deck))).toEqual(deck);
  });
  it('rejects future versions, unsafe properties, malformed dimensions and duplicate identities', () => {
    const deck = newDeck();
    expect(() => parseNative(JSON.stringify({ ...deck, formatVersion: 2 }))).toThrow('version');
    expect(() => parseNative('{"__proto__":{}}')).toThrow('Unsafe');
    expect(() => parseNative(JSON.stringify({ ...deck, slides: [] }))).toThrow('slides');
    deck.slides[0].elements.push({ ...newElement('text'), w: -2 }); expect(() => serializeNative(deck)).toThrow('width');
    deck.slides[0].elements = []; deck.slides.push(structuredClone(deck.slides[0])); expect(() => serializeNative(deck)).toThrow('Duplicate');
  });
  it('never accepts remote or scriptable image sources in native decks', () => {
    const deck = newDeck(); for (const src of ['https://example.com/tracker.png', 'javascript:alert(1)', 'data:image/svg+xml;base64,PHN2Zz4=']) {
      deck.slides[0].elements = [{ ...newElement('image'), src }]; expect(() => serializeNative(deck)).toThrow('embedded');
    }
  });
});

const P = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function textShape(text: string) {
  return `<p:sp><p:nvSpPr><p:cNvPr id="2" name="Text"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr><a:xfrm><a:off x="914400" y="457200"/><a:ext cx="5486400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"/><a:noFill/></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr sz="2400" b="1"><a:solidFill><a:srgbClr val="A14C20"/></a:solidFill><a:latin typeface="Arial"/></a:rPr><a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`;
}
async function fixture(withExternalImage = false) {
  const zip = new JSZip();
  zip.file('ppt/presentation.xml', `<p:presentation xmlns:p="${P}" xmlns:r="${R}"><p:sldIdLst><p:sldId id="256" r:id="rId2"/><p:sldId id="257" r:id="rId1"/></p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`);
  zip.file('ppt/_rels/presentation.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${R}/slide" Target="slides/first.xml"/><Relationship Id="rId2" Type="${R}/slide" Target="slides/second.xml"/></Relationships>`);
  for (const [part, text] of [['first', 'Second slide'], ['second', 'First slide']]) {
    const picture = withExternalImage ? '<p:pic><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="1000000"/></a:xfrm></p:spPr><p:blipFill><a:blip r:link="remote"/></p:blipFill></p:pic>' : '';
    zip.file(`ppt/slides/${part}.xml`, `<p:sld xmlns:p="${P}" xmlns:a="${A}" xmlns:r="${R}"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="FFF8F2"/></a:solidFill></p:bgPr></p:bg><p:spTree>${textShape(text)}${picture}</p:spTree></p:cSld></p:sld>`);
  }
  zip.file('ppt/slides/_rels/second.xml.rels', `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="notes" Type="${R}/notesSlide" Target="../notesSlides/notes1.xml"/><Relationship Id="remote" Type="${R}/image" Target="https://example.com/tracker.png" TargetMode="External"/></Relationships>`);
  zip.file('ppt/notesSlides/notes1.xml', `<p:notes xmlns:p="${P}" xmlns:a="${A}"><p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr><p:ph type="body"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>Remember the example.</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:notes>`);
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

describe('bounded PowerPoint exchange', () => {
  it('reads presentation relationship order, explicit geometry, text styling, background and speaker notes', async () => {
    const deck = await importPptx(await fixture(), 'Example.pptx');
    expect(deck.name).toBe('Example'); expect(deck.slides.map(s => s.elements.find(e => e.type === 'text')?.text)).toEqual(['First slide', 'Second slide']);
    const text = deck.slides[0].elements[0]; expect(text).toMatchObject({ x: 96, y: 48, w: 576, h: 96, fontSize: 32, color: '#A14C20', bold: true, align: 'center' });
    expect(deck.slides[0].background).toBe('#FFF8F2'); expect(deck.slides[0].notes).toBe('Remember the example.');
  });
  it('does not fetch or retain externally linked images', async () => {
    const deck = await importPptx(await fixture(true), 'Linked.pptx');
    expect(deck.slides.flatMap(s => s.elements).some(e => e.type === 'image')).toBe(false);
    expect(deck.importWarnings?.some(w => w.includes('no external content'))).toBe(true);
  });
  it('exports a real OOXML ZIP with editable text, shape, notes, layout and a bounded import round trip', async () => {
    const deck = newDeck('Export test'); const text = { ...newElement('text'), text: 'Hello & <world>', fontSize: 40, x: 72, y: 90, w: 700, h: 100 };
    deck.slides[0].elements = [newElement('rect'), text]; deck.slides[0].notes = 'A real speaker note'; deck.slides.push(newSlide());
    const bytes = await exportPptx(deck); expect([...bytes.subarray(0, 2)]).toEqual([80, 75]);
    const zip = await JSZip.loadAsync(bytes); const raw = await zip.file('ppt/slides/slide1.xml')!.async('string');
    expect(raw).toContain('Hello &amp; &lt;world&gt;'); expect(raw).toContain('a:prstGeom');
    const presentation = new DOMParser().parseFromString(await zip.file('ppt/presentation.xml')!.async('string'), 'application/xml');
    const dims = presentation.getElementsByTagNameNS('*', 'sldSz')[0]; expect(Number(dims.getAttribute('cx')) / Number(dims.getAttribute('cy'))).toBeCloseTo(WIDTH / HEIGHT);
    const imported = await importPptx(bytes, 'Again.pptx'); expect(imported.slides).toHaveLength(2);
    expect(imported.slides[0].elements.find(e => e.type === 'text')).toMatchObject({ text: text.text, fontSize: 40, x: 72, y: 90 });
    expect(imported.slides[0].notes).toBe(deck.slides[0].notes);
  }, 30000);
  it('rejects non-PowerPoint, truncated ZIP and XML entity declarations', async () => {
    await expect(importPptx(new Uint8Array(22), 'Bad.pptx')).rejects.toThrow('ZIP');
    const zip = new JSZip(); zip.file('unrelated.txt', 'not a presentation'); await expect(importPptx(await zip.generateAsync({ type: 'uint8array' }), 'Bad.pptx')).rejects.toThrow('PowerPoint');
    zip.file('ppt/presentation.xml', '<!DOCTYPE p [<!ENTITY test "value">]><p/>'); await expect(importPptx(await zip.generateAsync({ type: 'uint8array' }), 'Bad.pptx')).rejects.toThrow('XML');
  });
  it('stops oversized actual inflation even when central-directory sizes are dishonest', async () => {
    const zip = new JSZip(); zip.file('ppt/presentation.xml', 'x'.repeat(2 * 1024 * 1024 + 20000));
    const bytes = await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' }), view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < bytes.length - 46; i++) if (view.getUint32(i, true) === 0x02014b50) { view.setUint32(i + 24, 1, true); break; }
    await expect(importPptx(bytes, 'Bounded.pptx')).rejects.toThrow('byte limit');
  });
});


describe('expanded slide elements, tables and charts', () => {
  it('supports tables with row/col structure and preserves data through serialization', () => {
    const deck = newDeck('Table Deck');
    const tableEl = newElement('table');
    tableEl.tableData = [
      ['Col 1', 'Col 2'],
      ['100', '200'],
    ];
    tableEl.tableRows = 2;
    tableEl.tableCols = 2;
    deck.slides[0].elements.push(tableEl);

    const serialized = serializeNative(deck);
    const parsed = parseNative(serialized);
    const parsedTable = parsed.slides[0].elements.find(e => e.type === 'table');
    expect(parsedTable).toBeDefined();
    expect(parsedTable?.tableData?.[0][0]).toBe('Col 1');
    expect(parsedTable?.tableRows).toBe(2);
  });

  it('supports charts with data points and preserves series', () => {
    const deck = newDeck('Chart Deck');
    const chartEl = newElement('chart');
    chartEl.chartType = 'bar';
    chartEl.chartTitle = 'Revenue';
    chartEl.chartData = [
      { label: 'Jan', value: 120 },
      { label: 'Feb', value: 250 },
    ];
    deck.slides[0].elements.push(chartEl);

    const parsed = parseNative(serializeNative(deck));
    const parsedChart = parsed.slides[0].elements.find(e => e.type === 'chart');
    expect(parsedChart).toBeDefined();
    expect(parsedChart?.chartTitle).toBe('Revenue');
    expect(parsedChart?.chartData?.length).toBe(2);
    expect(parsedChart?.chartData?.[1].value).toBe(250);
  });

  it('supports extended shapes: triangle, star, diamond', () => {
    const deck = newDeck('Shapes Deck');
    deck.slides[0].elements.push(newElement('triangle'), newElement('star'), newElement('diamond'));

    const parsed = parseNative(serializeNative(deck));
    expect(parsed.slides[0].elements.map(e => e.type)).toContain('triangle');
    expect(parsed.slides[0].elements.map(e => e.type)).toContain('star');
    expect(parsed.slides[0].elements.map(e => e.type)).toContain('diamond');
  });

  it('supports transitions and animations on slides and elements', () => {
    const deck = newDeck('Animated Deck');
    deck.slides[0].transition = { type: 'fade', duration: 1.2 };
    const textEl = newElement('text');
    textEl.animation = { type: 'fade-in', duration: 0.8, order: 1 };
    deck.slides[0].elements.push(textEl);

    const parsed = parseNative(serializeNative(deck));
    expect(parsed.slides[0].transition?.type).toBe('fade');
    expect(parsed.slides[0].transition?.duration).toBe(1.2);
    expect(parsed.slides[0].elements[0].animation?.type).toBe('fade-in');
  });
});
