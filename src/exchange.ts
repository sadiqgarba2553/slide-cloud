import JSZip from 'jszip';
import PptxGenJS from 'pptxgenjs';
import { WIDTH, HEIGHT, MAX_ELEMENTS, MAX_SLIDES, newDeck, newElement, newSlide, parseNative, serializeNative, type Deck, type SlideElement } from './model';

const MAX_ZIP = 32 * 1024 * 1024;
const MAX_EXPANDED = 80 * 1024 * 1024;
const MAX_XML = 2 * 1024 * 1024;
const MAX_IMAGE = 8 * 1024 * 1024;
const EMU = 914400;
const hex = (value: string | undefined, fallback = '202420') => value && /^#[\da-f]{6}$/i.test(value) ? value.slice(1) : fallback;

async function officeImage(src: string): Promise<string> {
  if (/^data:image\/(png|jpeg);base64,/.test(src)) return src;
  // Office handles embedded PNG/JPEG predictably. GIF/WebP become a static PNG.
  const image = new Image();
  await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(Error('An image could not be decoded for PPTX export')); image.src = src; });
  if (image.naturalWidth * image.naturalHeight > 16000000) throw Error('An image exceeds the 16 megapixel PPTX export limit');
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d'); if (!context) throw Error('Image conversion is unavailable');
  context.drawImage(image, 0, 0); return canvas.toDataURL('image/png');
}

export async function exportPptx(deck: Deck): Promise<Uint8Array> {
  // Validate before exchanging a document, including callers that bypass the importer.
  const valid = parseNative(serializeNative(deck)), pptx = new PptxGenJS();
  pptx.defineLayout({ name: 'SLIDE_CLOUD', width: WIDTH / 96, height: HEIGHT / 96 }); pptx.layout = 'SLIDE_CLOUD';
  pptx.author = 'BlueCloud AI Technologies'; pptx.subject = 'Created with Slide Cloud'; pptx.title = valid.name; pptx.company = 'BlueCloud AI Technologies';
  for (const page of valid.slides) {
    const slide = pptx.addSlide(); slide.background = { color: hex(page.background, 'FFFFFF') };
    if (page.notes) slide.addNotes(page.notes);
    for (const e of page.elements) {
      const position = { x: e.x / 96, y: e.y / 96, w: e.w / 96, h: e.h / 96, rotate: e.rotation || 0 };
      if (e.type === 'text') {
        slide.addText(e.text || '', { ...position, fontFace: e.fontFamily || 'Arial', fontSize: (e.fontSize || 36) * 0.75,
          color: hex(e.color), bold: !!e.bold, italic: !!e.italic, align: e.align || 'left', margin: 0, valign: 'top',
          breakLine: false, lineSpacingMultiple: 1.15, transparency: e.color === 'transparent' ? 100 : 0 });
      } else if (e.type === 'image' && e.src) {
        slide.addImage({ ...position, data: await officeImage(e.src) });
      } else if (e.type === 'rect' || e.type === 'ellipse' || e.type === 'line') {
        slide.addShape(e.type === 'rect' ? pptx.ShapeType.rect : e.type === 'ellipse' ? pptx.ShapeType.ellipse : pptx.ShapeType.line,
          { ...position, fill: { color: hex(e.fill, 'FF914D'), transparency: e.fill === 'transparent' ? 100 : 0 },
            line: { color: hex(e.stroke, 'C75719'), width: (e.strokeWidth || 0) * 0.75, transparency: !e.strokeWidth || e.stroke === 'transparent' ? 100 : 0 } });
      }
    }
  }
  const result = await pptx.write({ outputType: 'arraybuffer', compression: true });
  if (result instanceof ArrayBuffer) return new Uint8Array(result);
  if (result instanceof Uint8Array) return result;
  throw Error('PPTX export did not produce a binary document');
}

function inspectZip(bytes: Uint8Array) {
  if (bytes.length > MAX_ZIP || bytes.length < 22) throw Error('PPTX must be a ZIP package smaller than 32 MB');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) { end = i; break; }
  if (end < 0 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) throw Error('Unsupported or truncated PPTX ZIP package');
  const count = view.getUint16(end + 10, true), size = view.getUint32(end + 12, true), offset = view.getUint32(end + 16, true);
  if (!count || count > 3000 || count === 65535 || offset === 0xffffffff || size === 0xffffffff || offset + size > end) throw Error('PPTX ZIP directory exceeds supported limits');
  let cursor = offset, expanded = 0;
  const names = new Set<string>();
  for (let n = 0; n < count; n++) {
    if (cursor + 46 > offset + size || view.getUint32(cursor, true) !== 0x02014b50) throw Error('Invalid PPTX ZIP directory');
    const flags = view.getUint16(cursor + 8, true), length = view.getUint32(cursor + 24, true), nameLength = view.getUint16(cursor + 28, true), extra = view.getUint16(cursor + 30, true), comment = view.getUint16(cursor + 32, true);
    if (flags & 1 || length === 0xffffffff || length > 16 * 1024 * 1024) throw Error('Encrypted or oversized PPTX member');
    const next = cursor + 46 + nameLength + extra + comment; if (next > offset + size) throw Error('Truncated PPTX ZIP directory');
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    if (!name || name.includes('\\') || name.startsWith('/') || name.split('/').includes('..') || name.includes('\0') || names.has(name)) throw Error('Unsafe or duplicate PPTX package path');
    names.add(name); expanded += length; if (expanded > MAX_EXPANDED) throw Error('Expanded PPTX exceeds 80 MB'); cursor = next;
  }
}
function xml(text: string): Document {
  if (text.length > MAX_XML || /<!DOCTYPE|<!ENTITY/i.test(text)) throw Error('Unsupported or oversized PPTX XML');
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.getElementsByTagName('parsererror').length) throw Error('Malformed PPTX XML'); return document;
}
// Stop inflating at the actual byte limit, even when a hostile ZIP lies about
// expanded sizes in its central directory. Unread members are never inflated.
interface ReadBudget { used: number }
// JSZip exposes this documented streaming API at runtime, but 3.10.1's bundled
// declarations omit it from JSZipObject.
interface ZipStream {
  on(event: 'data', listener: (bytes: Uint8Array) => void): ZipStream;
  on(event: 'error', listener: (error: Error) => void): ZipStream;
  on(event: 'end', listener: () => void): ZipStream;
  pause(): void; resume(): void;
}
function boundedRead(entry: JSZip.JSZipObject, limit: number, budget: ReadBudget): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const streaming = entry as unknown as { internalStream(type: 'uint8array'): ZipStream };
    const stream = streaming.internalStream('uint8array'), chunks: Uint8Array[] = []; let length = 0, failed = false;
    stream.on('data', (bytes: Uint8Array) => {
      if (failed) return;
      length += bytes.length; budget.used += bytes.length;
      if (length > limit || budget.used > MAX_EXPANDED) { failed = true; stream.pause(); reject(Error('Expanded PPTX member exceeds its byte limit')); return; }
      chunks.push(bytes);
    }).on('error', error => { failed = true; reject(error); }).on('end', () => {
      if (failed) return; const bytes = new Uint8Array(length); let at = 0;
      for (const chunk of chunks) { bytes.set(chunk, at); at += chunk.length; } resolve(bytes);
    });
    stream.resume();
  });
}
async function readXml(entry: JSZip.JSZipObject, budget: ReadBudget): Promise<Document> { return xml(new TextDecoder().decode(await boundedRead(entry, MAX_XML, budget))); }
const descendants = (node: Document | Element, name: string) => Array.from(node.getElementsByTagNameNS('*', name));
const first = (node: Document | Element | undefined, name: string): Element | undefined => node ? descendants(node, name)[0] : undefined;
const child = (node: Element | undefined, name: string): Element | undefined => node ? Array.from(node.children).find(e => e.localName === name) : undefined;
const attr = (node: Element | undefined, key: string, fallback = '') => node?.getAttribute(key) ?? fallback;
function relationshipId(node: Element | undefined, localName: string): string {
  if (!node) return '';
  return node.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', localName)
    || Array.from(node.attributes).find(a => a.localName === localName && !!a.namespaceURI)?.value || '';
}
function partPath(from: string, relative: string): string {
  if (/^[a-z]+:|^\/\/|\\|\0/i.test(relative)) throw Error('External PPTX part reference is unsupported');
  const parts = relative.startsWith('/') ? [] : from.split('/').slice(0, -1);
  for (const part of relative.split('/')) { if (!part || part === '.') continue; if (part === '..') { if (!parts.length) throw Error('PPTX part reference escapes package'); parts.pop(); } else parts.push(part); }
  return parts.join('/');
}
function relPart(part: string) { const split = part.lastIndexOf('/'); return part.slice(0, split + 1) + '_rels/' + part.slice(split + 1) + '.rels'; }
interface Relationship { type: string; target: string; external: boolean }
async function relationships(zip: JSZip, part: string, budget: ReadBudget): Promise<Map<string, Relationship>> {
  const entry = zip.file(relPart(part)), result = new Map<string, Relationship>(); if (!entry) return result;
  const document = await readXml(entry, budget);
  for (const r of descendants(document, 'Relationship')) result.set(attr(r, 'Id'), { type: attr(r, 'Type'), target: attr(r, 'Target'), external: attr(r, 'TargetMode') === 'External' });
  return result;
}
function rgb(parent: Element | undefined, palette: Record<string, string>, fallback: string): string {
  if (!parent) return fallback;
  const solid = parent.localName === 'solidFill' ? parent : child(parent, 'solidFill'); if (!solid) return child(parent, 'noFill') ? 'transparent' : fallback;
  const direct = child(solid, 'srgbClr'), system = child(solid, 'sysClr'), scheme = child(solid, 'schemeClr');
  const value = attr(direct, 'val') || attr(system, 'lastClr');
  return /^[\da-f]{6}$/i.test(value) ? '#' + value : scheme ? palette[attr(scheme, 'val')] || fallback : fallback;
}
function baseGeometry(shape: Element, sx: number, sy: number): { x: number; y: number; w: number; h: number; rotation: number } | null {
  const transform = first(child(shape, 'spPr'), 'xfrm'), off = child(transform, 'off'), ext = child(transform, 'ext');
  const ph = first(shape, 'ph'), title = ['title', 'ctrTitle'].includes(attr(ph, 'type'));
  const x = off ? Number(attr(off, 'x')) * sx : 64, y = off ? Number(attr(off, 'y')) * sy : title ? 80 : 260;
  const w = ext ? Number(attr(ext, 'cx')) * sx : 832, h = ext ? Number(attr(ext, 'cy')) * sy : title ? 150 : 210;
  const rotation = Number(attr(transform, 'rot', '0')) / 60000;
  if (![x, y, w, h, rotation].every(Number.isFinite) || Math.abs(x) > WIDTH * 4 || Math.abs(y) > HEIGHT * 4 || w > WIDTH * 4 || h > HEIGHT * 4 || w < 0 || h < 0) return null;
  return { x, y, w: Math.max(1, w), h: Math.max(1, h), rotation: ((rotation % 360) + 360) % 360 };
}
function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71) return 'png';
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (new TextDecoder().decode(bytes.subarray(0, 4)) === 'GIF8') return 'gif';
  if (new TextDecoder().decode(bytes.subarray(0, 4)) === 'RIFF' && new TextDecoder().decode(bytes.subarray(8, 12)) === 'WEBP') return 'webp';
  return null;
}
function base64(bytes: Uint8Array): string { let binary = ''; for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192)); return btoa(binary); }

export async function importPptx(bytes: Uint8Array, name: string): Promise<Deck> {
  inspectZip(bytes); const zip = await JSZip.loadAsync(bytes), budget = { used: 0 };
  const rootEntry = zip.file('ppt/presentation.xml'); if (!rootEntry) throw Error('This package is not a supported PowerPoint presentation');
  const root = await readXml(rootEntry, budget), rootRels = await relationships(zip, 'ppt/presentation.xml', budget);
  const size = first(root, 'sldSz'), cx = Number(attr(size, 'cx', String(EMU * 10))), cy = Number(attr(size, 'cy', String(EMU * 5.625)));
  if (!Number.isFinite(cx) || !Number.isFinite(cy) || cx <= 0 || cy <= 0) throw Error('Invalid PowerPoint slide dimensions');
  const sx = WIDTH / cx, sy = HEIGHT / cy, deck = newDeck(name.replace(/\.pptx$/i, '').slice(0, 240) || 'Imported presentation'); deck.slides = [];
  const warnings = new Set<string>(['PPTX import is a basic compatibility subset. Theme inheritance, rich text runs, masters, groups, tables, charts, transitions, animations, embedded media and unsupported objects may change or be omitted.']);
  if (Math.abs(cx / cy - WIDTH / HEIGHT) > 0.02) warnings.add('This presentation was scaled to the 16:9 Slide Cloud canvas; its original aspect ratio differs.');
  const palette: Record<string, string> = { dk1: '#000000', lt1: '#FFFFFF', dk2: '#44546A', lt2: '#E7E6E6', accent1: '#4472C4', accent2: '#ED7D31', tx1: '#000000', bg1: '#FFFFFF' };
  const themeEntry = zip.file('ppt/theme/theme1.xml'); if (themeEntry) {
    const scheme = first(await readXml(themeEntry, budget), 'clrScheme');
    for (const e of Array.from(scheme?.children || [])) { const value = attr(child(e, 'srgbClr'), 'val') || attr(child(e, 'sysClr'), 'lastClr'); if (/^[\da-f]{6}$/i.test(value)) palette[e.localName] = '#' + value; }
    palette.tx1 = palette.dk1; palette.bg1 = palette.lt1;
  }
  const ids = descendants(root, 'sldId'); if (!ids.length || ids.length > MAX_SLIDES) throw Error(`PPTX must contain 1–${MAX_SLIDES} slides`);
  for (const id of ids) {
    const relationship = rootRels.get(relationshipId(id, 'id')); if (!relationship || relationship.external || !relationship.type.endsWith('/slide')) throw Error('Missing or invalid PowerPoint slide relationship');
    const part = partPath('ppt/presentation.xml', relationship.target), entry = zip.file(part); if (!entry) throw Error('A PowerPoint slide is missing');
    const document = await readXml(entry, budget), rels = await relationships(zip, part, budget), page = newSlide();
    page.background = rgb(first(document, 'bgPr'), palette, '#FFFFFF');
    const tree = first(document, 'spTree');
    for (const shape of Array.from(tree?.children || [])) {
      if (!['sp', 'pic', 'cxnSp'].includes(shape.localName)) { if (['grpSp', 'graphicFrame', 'contentPart'].includes(shape.localName)) warnings.add('Grouped objects, charts, tables and other unsupported objects were omitted.'); continue; }
      const geometry = baseGeometry(shape, sx, sy); if (!geometry) { warnings.add('An object outside supported geometry limits was omitted.'); continue; }
      if (!first(child(shape, 'spPr'), 'xfrm')) warnings.add('Some placeholder positions were approximated because inherited slide layouts are not imported.');
      if (shape.localName === 'pic') {
        const blip = first(shape, 'blip'), imageRel = rels.get(relationshipId(blip, 'embed'));
        if (!imageRel || imageRel.external || !imageRel.type.endsWith('/image')) { warnings.add('Linked or unsupported images were omitted; no external content was fetched.'); continue; }
        const imageEntry = zip.file(partPath(part, imageRel.target)); if (!imageEntry) { warnings.add('A missing image was omitted.'); continue; }
        const image = await boundedRead(imageEntry, MAX_IMAGE, budget), mime = imageMime(image);
        if (!mime || image.length > MAX_IMAGE) { warnings.add('An unsupported image or image larger than 8 MB was omitted.'); continue; }
        if (first(shape, 'srcRect')) warnings.add('Image cropping is not preserved during import.');
        page.elements.push({ ...newElement('image'), ...geometry, src: `data:image/${mime};base64,${base64(image)}` }); continue;
      }
      const props = child(shape, 'spPr'), preset = attr(first(props, 'prstGeom'), 'prst'), body = child(shape, 'txBody');
      const line = child(props, 'ln'), fill = rgb(props, palette, 'transparent'), stroke = rgb(line, palette, '#202420');
      const lineWidth = Math.min(40, Math.max(0, Number(attr(line, 'w', '0')) / 12700 / 0.75));
      if (preset || shape.localName === 'cxnSp') {
        const type = preset === 'ellipse' ? 'ellipse' : preset === 'line' || shape.localName === 'cxnSp' ? 'line' : 'rect';
        if (preset && !['rect', 'roundRect', 'ellipse', 'line'].includes(preset)) warnings.add('Some unsupported shape geometries were approximated as rectangles.');
        // Text boxes often encode rect with no fill/line; avoid inserting an invisible duplicate.
        if (!body || fill !== 'transparent' || lineWidth > 0 || type === 'line') page.elements.push({ ...newElement(type), ...geometry, fill, stroke, strokeWidth: lineWidth });
      }
      if (body) {
        const paragraphs = descendants(body, 'p'), content = paragraphs.map(p => Array.from(p.children).map(n => n.localName === 'br' ? '\n' : n.localName === 'r' || n.localName === 'fld' ? descendants(n, 't').map(t => t.textContent || '').join('') : '').join('')).join('\n');
        const rp = first(body, 'rPr') || first(body, 'defRPr'), pp = first(body, 'pPr'), font = child(rp, 'latin');
        const fontSize = Number(attr(rp, 'sz', '2400')) / 100 / 0.75, alignment = attr(pp, 'algn');
        page.elements.push({ ...newElement('text'), ...geometry, text: content.slice(0, 50000), fontSize: Math.min(300, Math.max(6, fontSize)), fontFamily: attr(font, 'typeface', 'Arial').slice(0, 100),
          bold: attr(rp, 'b') === '1', italic: attr(rp, 'i') === '1', color: rgb(rp, palette, '#202420'), align: alignment === 'ctr' ? 'center' : alignment === 'r' ? 'right' : 'left' });
      }
      if (page.elements.length > MAX_ELEMENTS) throw Error(`A slide contains more than ${MAX_ELEMENTS} supported elements`);
    }
    const notesRel = Array.from(rels.values()).find(r => r.type.endsWith('/notesSlide') && !r.external);
    if (notesRel) {
      const notesEntry = zip.file(partPath(part, notesRel.target));
      if (notesEntry) { const notesDoc = await readXml(notesEntry, budget); page.notes = descendants(notesDoc, 'sp').filter(s => attr(first(s, 'ph'), 'type') === 'body').map(s => descendants(s, 'p').map(p => descendants(p, 't').map(t => t.textContent || '').join('')).join('\n')).join('\n').slice(0, 100000); }
    }
    deck.slides.push(page);
  }
  deck.importWarnings = [...warnings]; return parseNative(serializeNative(deck));
}
