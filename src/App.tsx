import { useEffect, useRef, useState, ReactNode, PointerEvent as ReactPointerEvent } from 'react';
import {
  Plus,
  FolderOpen,
  Search,
  Clock,
  LayoutTemplate,
  Settings,
  Check,
  X,
  Play,
  Undo2,
  Redo2,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  Type,
  Image as ImageIcon,
  Square,
  Circle,
  Minus,
  ChevronLeft,
  ChevronRight,
  Download,
  Save,
  History,
  Monitor,
  Sun,
  Moon,
  Layers,
  Table as TableIcon,
  BarChart2,
  Triangle,
  Star,
  Maximize2,
  Compass,
} from 'lucide-react';
import {
  newDeck,
  newSlide,
  newElement,
  templateDeck,
  TEMPLATES,
  parseNative,
  serializeNative,
  validImage,
  WIDTH,
  HEIGHT,
  MAX_ELEMENTS,
  MAX_SLIDES,
  type Deck,
  type SlideElement,
  type ElementType,
  type SlideTransition,
} from './model';
import { store } from './store';
import { isNative, openNative, writeNative, download } from './files';
import { SlideView, ElementView } from './SlideView';
import { Modal } from './Modal';

type Dialog = 'file' | 'history' | 'settings' | 'pptx' | 'help' | 'delete' | 'export-svg' | null;

const clone = <T,>(value: T): T => structuredClone(value);
const cap = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const cleanName = (name: string) =>
  (name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '-').trim() || 'Presentation').slice(0, 100);

const themes = [
  { name: 'Paper', bg: '#FFFFFF', ink: '#202420', accent: '#C75719' },
  { name: 'Midnight', bg: '#192724', ink: '#F4F3ED', accent: '#FF914D' },
  { name: 'Warm', bg: '#FFF2E7', ink: '#3F2820', accent: '#B74B20' },
  { name: 'Blue', bg: '#ECF2FA', ink: '#17335C', accent: '#3156A4' },
];

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand ${compact ? 'compact' : ''}`}>
      <img src="/logo.svg" alt="" />
      <span>
        slide cloud{!compact && <small>BY BLUECLOUD</small>}
      </span>
    </span>
  );
}

function ShowDialog({ close, children }: { close: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    dialog.showModal();
    return () => dialog.close();
  }, []);
  return (
    <dialog ref={ref} className="slideshow" aria-label="Slideshow" onCancel={close}>
      {children}
    </dialog>
  );
}

export default function App() {
  const [decks, setDecks] = useState<Deck[]>([]),
    [deck, setDeck] = useState<Deck | null>(null),
    current = useRef<Deck | null>(null);
  const [index, setIndex] = useState(0),
    [selected, setSelected] = useState<string | null>(null),
    [editing, setEditing] = useState<string | null>(null);
  const [undo, setUndo] = useState<Deck[]>([]),
    [redo, setRedo] = useState<Deck[]>([]);
  const [dialog, setDialog] = useState<Dialog>(null),
    [tab, setTab] = useState('Home'),
    [filter, setFilter] = useState('all'),
    [query, setQuery] = useState('');
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(''),
    [saved, setSaved] = useState(true);
  const [showNotes, setShowNotes] = useState(true),
    [presenting, setPresenting] = useState(false),
    [presenterView, setPresenterView] = useState(false),
    [elapsedSecs, setElapsedSecs] = useState(0),
    [timerRunning, setTimerRunning] = useState(false),
    [versionName, setVersionName] = useState(''),
    [deleteId, setDeleteId] = useState('');
  const [appearance, setAppearance] = useState(() => localStorage.getItem('slidecloud-appearance') || 'system');
  const sourceFile = useRef<{ path: string; bytes: Uint8Array } | undefined>(),
    fileInput = useRef<HTMLInputElement>(null),
    imageInput = useRef<HTMLInputElement>(null),
    stage = useRef<SVGSVGElement>(null);
  const saveRevision = useRef(0),
    textarea = useRef<HTMLTextAreaElement>(null);
  const drag = useRef<{ id: string; x: number; y: number; original: SlideElement; resize: boolean } | null>(null);
  const slide = deck?.slides[index],
    element = slide?.elements.find(e => e.id === selected);
  const templates = useRef(TEMPLATES.map(t => ({ ...t, deck: templateDeck(t.id) })));

  async function reload() {
    try {
      setDecks((await store.list()).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (e) {
      setError(String(e));
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    const media = matchMedia('(prefers-color-scheme: dark)'),
      apply = () =>
        document.documentElement.classList.toggle(
          'dark',
          appearance === 'dark' || (appearance === 'system' && media.matches)
        );
    apply();
    localStorage.setItem('slidecloud-appearance', appearance);
    media.addEventListener('change', apply);
    return () => media.removeEventListener('change', apply);
  }, [appearance]);

  useEffect(() => {
    if (!deck) return;
    setSaved(false);
    const revision = ++saveRevision.current;
    const timer = setTimeout(() => {
      void store
        .save(deck)
        .then(() => {
          if (revision === saveRevision.current) setSaved(true);
        })
        .catch(e => setError(String(e)));
    }, 700);
    return () => clearTimeout(timer);
  }, [deck]);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(''), 5500);
    return () => clearTimeout(timer);
  }, [message]);

  useEffect(() => {
    if (editing) {
      textarea.current?.focus();
      textarea.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (presenterView && timerRunning) {
      interval = setInterval(() => setElapsedSecs(s => s + 1), 1000);
    }
    return () => clearInterval(interval);
  }, [presenterView, timerRunning]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (current.current && !saved) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [saved]);

  async function task(label: string, action: () => Promise<void>) {
    setError('');
    setBusy(label);
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy('');
    }
  }

  function assign(next: Deck | null) {
    current.current = next;
    setDeck(next);
  }

  function change(action: (d: Deck) => void) {
    const old = current.current;
    if (!old) return;
    const next = clone(old);
    action(next);
    if (JSON.stringify(next).length > 32 * 1024 * 1024) {
      setError('This change would exceed the 32 MB native presentation limit. Use fewer or smaller images.');
      return;
    }
    next.updatedAt = new Date().toISOString();
    setUndo(u => [...u.slice(-49), old]);
    setRedo([]);
    assign(next);
  }

  function patch(update: Partial<SlideElement>) {
    if (selected)
      change(d => {
        const e = d.slides[index].elements.find(e => e.id === selected);
        if (e) Object.assign(e, update);
      });
  }

  async function flush() {
    if (current.current) await store.save(current.current);
  }

  async function open(d: Deck, fresh = false) {
    await task('Opening presentation', async () => {
      await flush();
      if (fresh) await store.save(d);
      assign(clone(d));
      setIndex(0);
      setSelected(null);
      setEditing(null);
      setUndo([]);
      setRedo([]);
      sourceFile.current = undefined;
      setDialog(null);
    });
  }

  async function home() {
    await task('Saving presentation', async () => {
      await flush();
      assign(null);
      setSelected(null);
      setEditing(null);
      setUndo([]);
      setRedo([]);
      await reload();
    });
  }

  function historyStep(back: boolean) {
    const list = back ? undo : redo,
      next = list.at(-1);
    if (!next || !deck) return;
    (back ? setUndo : setRedo)(list.slice(0, -1));
    (back ? setRedo : setUndo)(v => [...v.slice(-49), deck]);
    assign(clone(next));
    setIndex(i => Math.min(i, next.slides.length - 1));
    setSelected(null);
    setEditing(null);
  }

  function addObject(type: ElementType) {
    if (!slide || slide.elements.length >= MAX_ELEMENTS) {
      setError(`A slide supports up to ${MAX_ELEMENTS} objects.`);
      return;
    }
    const e = newElement(type);
    change(d => d.slides[index].elements.push(e));
    setSelected(e.id);
    setTab('Home');
    if (type === 'text') setEditing(e.id);
  }

  function addSlide() {
    if (!deck || deck.slides.length >= MAX_SLIDES) {
      setError(`Presentations support up to ${MAX_SLIDES} slides.`);
      return;
    }
    const s = newSlide();
    s.background = slide!.background;
    change(d => d.slides.splice(index + 1, 0, s));
    setIndex(index + 1);
    setSelected(null);
    setEditing(null);
  }

  function duplicateSlide(at = index) {
    if (!deck || deck.slides.length >= MAX_SLIDES) return;
    const s = clone(deck.slides[at]);
    s.id = crypto.randomUUID();
    s.elements.forEach(e => (e.id = crypto.randomUUID()));
    change(d => d.slides.splice(at + 1, 0, s));
    setIndex(at + 1);
    setSelected(null);
    setEditing(null);
  }

  function moveSlide(direction: number) {
    if (!deck || index + direction < 0 || index + direction >= deck.slides.length) return;
    change(d => {
      const [s] = d.slides.splice(index, 1);
      d.slides.splice(index + direction, 0, s);
    });
    setIndex(index + direction);
  }

  function deleteSlide() {
    if (!deck || deck.slides.length === 1) return;
    change(d => d.slides.splice(index, 1));
    setIndex(Math.max(0, index - 1));
    setSelected(null);
    setEditing(null);
  }

  function duplicateObject() {
    if (!element || !slide || slide.elements.length >= MAX_ELEMENTS) return;
    const e = clone(element);
    e.id = crypto.randomUUID();
    e.x += 20;
    e.y += 20;
    change(d => d.slides[index].elements.push(e));
    setSelected(e.id);
  }

  function removeObject() {
    if (!selected) return;
    change(d => {
      d.slides[index].elements = d.slides[index].elements.filter(e => e.id !== selected);
    });
    setSelected(null);
    setEditing(null);
  }

  function layer(front: boolean) {
    if (!selected) return;
    change(d => {
      const list = d.slides[index].elements,
        at = list.findIndex(e => e.id === selected);
      if (at < 0) return;
      const [e] = list.splice(at, 1);
      front ? list.push(e) : list.unshift(e);
    });
  }

  async function importFile(bytes: Uint8Array, name: string, path?: string) {
    await task('Opening presentation', async () => {
      if (bytes.length > 32 * 1024 * 1024) throw Error('Presentations must be smaller than 32 MB.');
      const pptx = name.toLowerCase().endsWith('.pptx');
      if (!pptx && !name.toLowerCase().endsWith('.slidecloud'))
        throw Error('Open a .slidecloud or .pptx presentation. Legacy .ppt files are not supported.');
      const d = pptx
        ? await (await import('./exchange')).importPptx(bytes, name)
        : parseNative(new TextDecoder().decode(bytes));
      d.id = crypto.randomUUID();
      d.updatedAt = new Date().toISOString();
      await flush();
      await store.save(d);
      if (pptx) await store.original(d.id, name, bytes);
      assign(d);
      setIndex(0);
      setSelected(null);
      setEditing(null);
      setUndo([]);
      setRedo([]);
      sourceFile.current = path && !pptx ? { path, bytes } : undefined;
      setDialog(null);
      setMessage(
        pptx
          ? 'PPTX imported. Review slides, shapes and notes before presenting.'
          : 'Presentation opened.'
      );
    });
  }

  async function openFile() {
    if (isNative()) {
      await task('Choosing a presentation', async () => {
        const result = await openNative();
        if (result) await importFile(result.bytes, result.name, result.path);
      });
    } else fileInput.current?.click();
  }

  async function saveFile(as = false) {
    if (!current.current) return;
    await task('Saving presentation', async () => {
      const d = current.current!;
      const text = serializeNative(d),
        name = cleanName(d.name) + '.slidecloud';
      try {
        await flush();
      } catch {
        setError('The local library could not be saved. Keep this exported native backup.');
      }
      if (isNative()) {
        const result = await writeNative(text, name, as ? undefined : sourceFile.current);
        if (!result) return;
        sourceFile.current = result;
      } else download(text, name);
      setMessage('Native backup saved.');
    });
  }

  async function exportPowerPoint() {
    setDialog(null);
    await task('Exporting PowerPoint file', async () => {
      if (!deck) return;
      const bytes = await (await import('./exchange')).exportPptx(deck);
      if (isNative()) {
        if (!(await writeNative(bytes, cleanName(deck.name) + '.pptx'))) return;
      } else download(bytes, cleanName(deck.name) + '.pptx');
      setMessage('PPTX exported. Review formatting in your destination app.');
    });
  }

  async function restoreOriginal() {
    if (!deck) return;
    await task('Retrieving original import', async () => {
      const original = await store.getOriginal(deck.id);
      if (!original) throw Error('This presentation has no retained PPTX original.');
      if (isNative()) await writeNative(original.data, original.name);
      else download(original.data, original.name);
    });
  }

  async function addImage(file?: File) {
    if (!file) return;
    await task('Adding image', async () => {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(file.type) || file.size > 8 * 1024 * 1024)
        throw Error('Choose a PNG, JPEG, WebP or GIF image smaller than 8 MB.');
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      if (!validImage(src)) throw Error('This image is not supported.');
      const img = new window.Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(Error('The image could not be decoded.'));
        img.src = src;
      });
      if (!current.current || current.current.slides[index].elements.length >= MAX_ELEMENTS)
        throw Error('This slide has reached its object limit.');
      const e = {
        ...newElement('image'),
        src,
        w: Math.min(500, img.naturalWidth),
        h: (Math.min(500, img.naturalWidth) * img.naturalHeight) / img.naturalWidth,
      };
      if (e.h > 400) {
        e.w *= 400 / e.h;
        e.h = 400;
      }
      e.x = (WIDTH - e.w) / 2;
      e.y = (HEIGHT - e.h) / 2;
      change(d => d.slides[index].elements.push(e));
      setSelected(e.id);
      setEditing(null);
    });
  }

  function startDrag(event: ReactPointerEvent<SVGGElement>, id: string, resize = false) {
    if (editing) return;
    const e = slide?.elements.find(e => e.id === id);
    if (!e || !deck || e.locked) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    setSelected(id);
    setUndo(u => [...u.slice(-49), deck]);
    setRedo([]);
    drag.current = { id, x: event.clientX, y: event.clientY, original: clone(e), resize };
  }

  function moveObject(event: ReactPointerEvent<SVGSVGElement>) {
    const gesture = drag.current,
      bounds = stage.current?.getBoundingClientRect(),
      old = current.current;
    if (!gesture || !bounds || !old) return;
    const dx = ((event.clientX - gesture.x) * WIDTH) / bounds.width,
      dy = ((event.clientY - gesture.y) * HEIGHT) / bounds.height;
    const next = clone(old),
      e = next.slides[index].elements.find(e => e.id === gesture.id);
    if (!e) return;
    if (gesture.resize) {
      e.w = cap(gesture.original.w + dx, 10, WIDTH * 2);
      e.h = cap(gesture.original.h + dy, 2, HEIGHT * 2);
    } else {
      e.x = cap(gesture.original.x + dx, -e.w + 20, WIDTH - 20);
      e.y = cap(gesture.original.y + dy, -e.h + 10, HEIGHT - 10);
    }
    next.updatedAt = new Date().toISOString();
    assign(next);
  }

  async function present() {
    if (!deck) return;
    await flush().catch(e => setError(String(e)));
    setSelected(null);
    setEditing(null);
    setPresenting(true);
  }

  async function openPresenterView() {
    if (!deck) return;
    await flush().catch(e => setError(String(e)));
    setSelected(null);
    setEditing(null);
    setElapsedSecs(0);
    setTimerRunning(true);
    setPresenterView(true);
  }

  function endShow() {
    setPresenting(false);
    setPresenterView(false);
    setTimerRunning(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  }

  useEffect(() => {
    const keyboard = (e: KeyboardEvent) => {
      if (presenting || presenterView) {
        if (e.key === 'Escape') endShow();
        if (['ArrowRight', 'PageDown', ' '].includes(e.key)) {
          e.preventDefault();
          setIndex(i => Math.min((current.current?.slides.length || 1) - 1, i + 1));
        }
        if (['ArrowLeft', 'PageUp'].includes(e.key)) {
          e.preventDefault();
          setIndex(i => Math.max(0, i - 1));
        }
        return;
      }
      if (!deck || dialog) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void saveFile(e.shiftKey);
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,select,[contenteditable="true"]')) return;
      if (e.key === 'Escape') {
        setSelected(null);
        setEditing(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        historyStep(!e.shiftKey);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        historyStep(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        selected ? duplicateObject() : duplicateSlide();
      }
      if (selected && ['Delete', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        removeObject();
      }
      if (e.key === 'F5') {
        e.preventDefault();
        e.shiftKey ? void openPresenterView() : void present();
      }
      if (['PageDown', 'PageUp'].includes(e.key)) {
        e.preventDefault();
        setIndex(i => cap(i + (e.key === 'PageDown' ? 1 : -1), 0, deck.slides.length - 1));
        setSelected(null);
      }
      if (element && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        patch({
          x: cap(element.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0), -WIDTH * 2, WIDTH * 2),
          y: cap(element.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0), -HEIGHT * 2, HEIGHT * 2),
        });
      }
    };
    window.addEventListener('keydown', keyboard);
    return () => window.removeEventListener('keydown', keyboard);
  });

  const formatTimer = (s: number) => {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const banner = (
    <>
      {error && (
        <div className="notification error" role="alert">
          {error}
          <button aria-label="Dismiss error" onClick={() => setError('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {message && (
        <div className="notification" role="status">
          <Check size={16} />
          {message}
          <button aria-label="Dismiss notice" onClick={() => setMessage('')}>
            <X size={16} />
          </button>
        </div>
      )}
      {busy && (
        <div className="busy" role="status">
          <span />
          {busy}…
        </div>
      )}
    </>
  );

  return (
    <>
      <input
        ref={fileInput}
        type="file"
        accept=".slidecloud,.pptx"
        className="visually-hidden"
        aria-label="Open presentation file"
        onChange={e => {
          const file = e.target.files?.[0];
          if (file) void file.arrayBuffer().then(bytes => importFile(new Uint8Array(bytes), file.name));
          e.target.value = '';
        }}
      />
      <input
        ref={imageInput}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="visually-hidden"
        aria-label="Choose slide image"
        onChange={e => {
          void addImage(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {deck && slide ? (
        <div className="editor">
          <header className="editor-header">
            <button className="brand-button" aria-label="Back to presentations" onClick={() => void home()}>
              <Brand compact />
            </button>
            <div className="title-block">
              <input
                aria-label="Presentation title"
                maxLength={240}
                value={deck.name}
                onChange={e => change(d => (d.name = e.target.value))}
              />
              <span>
                <Check size={11} />
                {saved ? 'Saved on this device' : 'Saving locally…'}
              </span>
            </div>
            <div className="header-actions">
              <button className="icon" aria-label="Undo" disabled={!undo.length} onClick={() => historyStep(true)}>
                <Undo2 size={18} />
              </button>
              <button className="icon" aria-label="Redo" disabled={!redo.length} onClick={() => historyStep(false)}>
                <Redo2 size={18} />
              </button>
              <button className="secondary" onClick={() => setDialog('history')}>
                <History size={15} />History
              </button>
              <button className="secondary" onClick={() => void saveFile()}>
                <Save size={15} />Save
              </button>
              <button className="secondary" onClick={() => void openPresenterView()}>
                <Compass size={15} />Presenter View
              </button>
              <button className="primary" onClick={() => void present()}>
                <Play size={15} />Present
              </button>
            </div>
          </header>

          <nav className="ribbon-tabs" aria-label="Presentation tools">
            <button className="file-tab" onClick={() => setDialog('file')}>
              File
            </button>
            {['Home', 'Insert', 'Design', 'Transitions', 'Animations', 'View'].map(name => (
              <button
                key={name}
                aria-pressed={tab === name}
                className={tab === name ? 'active' : ''}
                onClick={() => setTab(name)}
              >
                {name}
              </button>
            ))}
            <span className="push muted">16:9 · Local workspace</span>
          </nav>

          <div className="ribbon">
            {tab === 'Home' && (
              <>
                <button onClick={addSlide}>
                  <Plus size={20} />New slide
                </button>
                <button onClick={() => addObject('text')}>
                  <Type size={20} />Text box
                </button>
                <span className="separator" />
                <label className="font-picker">
                  Font
                  <select
                    aria-label="Font family"
                    value={element?.fontFamily || 'Arial'}
                    disabled={element?.type !== 'text'}
                    onChange={e => patch({ fontFamily: e.target.value })}
                  >
                    {['Arial', 'Calibri', 'Georgia', 'Times New Roman', 'Verdana'].map(f => (
                      <option key={f}>{f}</option>
                    ))}
                  </select>
                </label>
                <label className="font-size">
                  Size
                  <input
                    aria-label="Font size"
                    type="number"
                    min={6}
                    max={300}
                    value={element?.fontSize || 28}
                    disabled={element?.type !== 'text'}
                    onChange={e => patch({ fontSize: cap(Number(e.target.value) || 6, 6, 300) })}
                  />
                </label>
                <button
                  className="style-button"
                  aria-label="Bold"
                  aria-pressed={!!element?.bold}
                  disabled={element?.type !== 'text'}
                  onClick={() => patch({ bold: !element?.bold })}
                >
                  <b>B</b>
                </button>
                <button
                  className="style-button"
                  aria-label="Italic"
                  aria-pressed={!!element?.italic}
                  disabled={element?.type !== 'text'}
                  onClick={() => patch({ italic: !element?.italic })}
                >
                  <i>I</i>
                </button>
                <span className="separator" />
                <button disabled={!element} onClick={duplicateObject}>
                  <Copy size={18} />Duplicate
                </button>
                <button disabled={!element} onClick={removeObject}>
                  <Trash2 size={18} />Delete
                </button>
              </>
            )}

            {tab === 'Insert' && (
              <>
                <button onClick={() => addObject('text')}>
                  <Type size={22} />Text box
                </button>
                <button onClick={() => imageInput.current?.click()}>
                  <ImageIcon size={22} />Picture
                </button>
                <span className="separator" />
                <button onClick={() => addObject('rect')}>
                  <Square size={22} />Rectangle
                </button>
                <button onClick={() => addObject('ellipse')}>
                  <Circle size={22} />Ellipse
                </button>
                <button onClick={() => addObject('triangle')}>
                  <Triangle size={22} />Triangle
                </button>
                <button onClick={() => addObject('star')}>
                  <Star size={22} />Star
                </button>
                <button onClick={() => addObject('line')}>
                  <Minus size={22} />Line
                </button>
                <span className="separator" />
                <button onClick={() => addObject('table')}>
                  <TableIcon size={22} />Table
                </button>
                <button onClick={() => addObject('chart')}>
                  <BarChart2 size={22} />Chart
                </button>
                <span className="separator" />
                <button onClick={addSlide}>
                  <Plus size={22} />Blank slide
                </button>
              </>
            )}

            {tab === 'Design' && (
              <>
                <span className="ribbon-label">Slide palette</span>
                {themes.map(t => (
                  <button
                    key={t.name}
                    className="theme"
                    onClick={() =>
                      change(d => {
                        const s = d.slides[index];
                        s.background = t.bg;
                        s.elements.forEach(e => {
                          if (e.type === 'text') e.color = t.ink;
                          else if (['rect', 'ellipse', 'triangle', 'star', 'diamond'].includes(e.type)) e.fill = t.accent;
                        });
                      })
                    }
                  >
                    <span style={{ background: t.bg, color: t.ink, borderColor: t.accent }}>Aa</span>
                    {t.name}
                  </button>
                ))}
                <span className="separator" />
                <label className="color-label">
                  Background
                  <input
                    type="color"
                    aria-label="Slide background"
                    value={slide.background}
                    onChange={e => change(d => (d.slides[index].background = e.target.value))}
                  />
                </label>
              </>
            )}

            {tab === 'Transitions' && (
              <>
                <span className="ribbon-label">Slide transition:</span>
                {(['none', 'fade', 'slide-left', 'slide-right', 'zoom'] as SlideTransition['type'][]).map(type => (
                  <button
                    key={type}
                    aria-pressed={(slide.transition?.type || 'none') === type}
                    onClick={() =>
                      change(d => {
                        d.slides[index].transition = {
                          type,
                          duration: d.slides[index].transition?.duration || 0.5,
                        };
                      })
                    }
                  >
                    {type[0].toUpperCase() + type.slice(1).replace('-', ' ')}
                  </button>
                ))}
                <span className="separator" />
                <label>
                  Duration (s)
                  <input
                    type="number"
                    min={0.1}
                    max={5}
                    step={0.1}
                    value={slide.transition?.duration || 0.5}
                    onChange={e =>
                      change(d => {
                        if (!d.slides[index].transition) d.slides[index].transition = { type: 'none', duration: 0.5 };
                        d.slides[index].transition!.duration = Number(e.target.value) || 0.5;
                      })
                    }
                  />
                </label>
              </>
            )}

            {tab === 'Animations' && (
              <>
                <span className="ribbon-label">Entrance effect:</span>
                {(['none', 'fade-in', 'fly-in-bottom', 'fly-in-left', 'zoom-in'] as const).map(effect => (
                  <button
                    key={effect}
                    disabled={!element}
                    aria-pressed={(element?.animation?.type || 'none') === effect}
                    onClick={() =>
                      patch({
                        animation: {
                          type: effect,
                          duration: element?.animation?.duration || 0.5,
                          order: element?.animation?.order || 0,
                        },
                      })
                    }
                  >
                    {effect[0].toUpperCase() + effect.slice(1).replace('-', ' ')}
                  </button>
                ))}
              </>
            )}

            {tab === 'View' && (
              <>
                <button onClick={() => void present()}>
                  <Play size={22} />Start slideshow
                </button>
                <button onClick={() => void openPresenterView()}>
                  <Compass size={22} />Presenter view
                </button>
                <button aria-pressed={showNotes} onClick={() => setShowNotes(!showNotes)}>
                  <LayoutTemplate size={22} />
                  {showNotes ? 'Hide notes' : 'Show notes'}
                </button>
                <button onClick={() => setDialog('settings')}>
                  <Settings size={22} />Appearance
                </button>
                <button onClick={() => setDialog('help')}>
                  <Monitor size={22} />Shortcuts & help
                </button>
              </>
            )}
          </div>

          <div className="workspace">
            <aside className="filmstrip" aria-label="Slides">
              <div className="filmstrip-heading">
                <span>
                  SLIDES <b>{deck.slides.length}</b>
                </span>
                <button
                  className="icon"
                  aria-label="Add slide"
                  disabled={deck.slides.length >= MAX_SLIDES}
                  onClick={addSlide}
                >
                  <Plus size={17} />
                </button>
              </div>
              <ol>
                {deck.slides.map((s, i) => (
                  <li key={s.id} className={i === index ? 'selected' : ''}>
                    <span>{String(i + 1).padStart(2, '0')}</span>
                    <button
                      className="thumbnail"
                      aria-label={`Go to slide ${i + 1}`}
                      aria-current={i === index ? 'true' : undefined}
                      onClick={() => {
                        setIndex(i);
                        setSelected(null);
                        setEditing(null);
                      }}
                    >
                      <SlideView slide={s} label={`Slide ${i + 1} preview`} />
                    </button>
                  </li>
                ))}
              </ol>
              <div className="slide-controls">
                <button
                  className="icon"
                  aria-label="Move slide up"
                  disabled={index === 0}
                  onClick={() => moveSlide(-1)}
                >
                  <ArrowUp size={16} />
                </button>
                <button
                  className="icon"
                  aria-label="Move slide down"
                  disabled={index === deck.slides.length - 1}
                  onClick={() => moveSlide(1)}
                >
                  <ArrowDown size={16} />
                </button>
                <button
                  className="icon"
                  aria-label="Duplicate slide"
                  disabled={deck.slides.length >= MAX_SLIDES}
                  onClick={() => duplicateSlide()}
                >
                  <Copy size={16} />
                </button>
                <button
                  className="icon"
                  aria-label="Delete slide"
                  disabled={deck.slides.length === 1}
                  onClick={deleteSlide}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </aside>

            <main className="canvas-column">
              <div className="canvas-topline">
                <span>
                  Slide {index + 1} of {deck.slides.length}
                </span>
                <span>{selected ? 'Drag to move · Corner handle to resize' : 'Select an object to customize'}</span>
              </div>
              <div className="stage-wrap">
                <div className="stage-shell">
                  <svg
                    ref={stage}
                    className="stage-svg"
                    viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                    role="application"
                    aria-label="Slide canvas"
                    onPointerDown={() => {
                      setSelected(null);
                      setEditing(null);
                    }}
                    onPointerMove={moveObject}
                    onPointerUp={() => (drag.current = null)}
                    onPointerCancel={() => (drag.current = null)}
                  >
                    <rect width={WIDTH} height={HEIGHT} fill={slide.background} />
                    {slide.elements.map((e, i) => (
                      <g
                        key={e.id}
                        role="button"
                        tabIndex={0}
                        aria-label={`${e.type} object ${i + 1}`}
                        aria-pressed={selected === e.id}
                        onFocus={() => setSelected(e.id)}
                        onPointerDown={event => startDrag(event, e.id)}
                        onDoubleClick={() => {
                          if (e.type === 'text') {
                            setSelected(e.id);
                            setEditing(e.id);
                          }
                        }}
                        onKeyDown={event => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            setSelected(e.id);
                            if (e.type === 'text') setEditing(e.id);
                          }
                        }}
                      >
                        <rect
                          x={e.x}
                          y={e.y}
                          width={e.w}
                          height={e.h}
                          fill="transparent"
                          transform={`rotate(${e.rotation || 0},${e.x + e.w / 2},${e.y + e.h / 2})`}
                        />
                        <ElementView element={e} />
                      </g>
                    ))}
                    {element && (
                      <g
                        className="selection"
                        transform={`translate(${element.x},${element.y}) rotate(${element.rotation || 0},${element.w / 2},${element.h / 2})`}
                      >
                        <rect
                          width={element.w}
                          height={element.h}
                          fill="none"
                          stroke="#CF551D"
                          strokeWidth={2}
                          vectorEffect="non-scaling-stroke"
                          pointerEvents="none"
                        />
                        <g onPointerDown={event => startDrag(event, element.id, true)} aria-label="Resize selected object">
                          <rect
                            x={element.w - 6}
                            y={element.h - 6}
                            width={12}
                            height={12}
                            fill="#fff"
                            stroke="#CF551D"
                            strokeWidth={2}
                            className="resize-handle"
                          />
                        </g>
                      </g>
                    )}
                  </svg>
                  {editing && element?.type === 'text' && (
                    <textarea
                      ref={textarea}
                      className="inline-editor"
                      aria-label="Edit slide text"
                      maxLength={50000}
                      style={{
                        left: `${(element.x / WIDTH) * 100}%`,
                        top: `${(element.y / HEIGHT) * 100}%`,
                        width: `${(element.w / WIDTH) * 100}%`,
                        height: `${(Math.max(element.h, 60) / HEIGHT) * 100}%`,
                        fontSize: `${(element.fontSize || 28) / 9.6}cqw`,
                        background: slide.background,
                        color: element.color,
                        fontFamily: element.fontFamily,
                        fontWeight: element.bold ? 700 : 400,
                      }}
                      value={element.text || ''}
                      onChange={e => patch({ text: e.target.value })}
                      onBlur={() => setEditing(null)}
                      onKeyDown={e => {
                        if (e.key === 'Escape') {
                          e.preventDefault();
                          setEditing(null);
                          stage.current?.focus();
                        }
                      }}
                    />
                  )}
                </div>
              </div>
              {showNotes && (
                <section className="notes">
                  <label htmlFor="speaker-notes">
                    SPEAKER NOTES <span>Private to editor · not shown in audience slideshow</span>
                  </label>
                  <textarea
                    id="speaker-notes"
                    placeholder="Add the thoughts and talking points for this slide…"
                    maxLength={100000}
                    value={slide.notes}
                    onChange={e => change(d => (d.slides[index].notes = e.target.value))}
                  />
                </section>
              )}
            </main>

            <aside className="inspector">
              <div className="inspector-heading">{element ? 'Format object' : 'Slide details'}</div>
              {element ? (
                <>
                  <div className="inspector-section">
                    <p className="inspector-kicker">{element.type.toUpperCase()}</p>
                    {element.type === 'text' && (
                      <>
                        <label>
                          Text
                          <textarea
                            aria-label="Object text"
                            value={element.text || ''}
                            maxLength={50000}
                            onChange={e => patch({ text: e.target.value })}
                          />
                        </label>
                        <label>
                          Text color
                          <input
                            type="color"
                            aria-label="Text color"
                            value={element.color || '#202420'}
                            onChange={e => patch({ color: e.target.value })}
                          />
                        </label>
                        <label>
                          Alignment
                          <select
                            aria-label="Text alignment"
                            value={element.align || 'left'}
                            onChange={e => patch({ align: e.target.value as SlideElement['align'] })}
                          >
                            <option value="left">Left</option>
                            <option value="center">Center</option>
                            <option value="right">Right</option>
                          </select>
                        </label>
                      </>
                    )}

                    {['rect', 'ellipse', 'triangle', 'star', 'diamond'].includes(element.type) && (
                      <>
                        <label>
                          Fill
                          <input
                            aria-label="Object fill"
                            type="color"
                            value={element.fill === 'transparent' ? '#ffffff' : element.fill || '#ff914d'}
                            onChange={e => patch({ fill: e.target.value })}
                          />
                        </label>
                        <label className="check-label">
                          <input
                            aria-label="Transparent fill"
                            type="checkbox"
                            checked={element.fill === 'transparent'}
                            onChange={e => patch({ fill: e.target.checked ? 'transparent' : '#ff914d' })}
                          />
                          Transparent fill
                        </label>
                      </>
                    )}

                    {element.type === 'table' && (
                      <>
                        <label>
                          Rows
                          <input
                            type="number"
                            min={1}
                            max={20}
                            value={element.tableRows || 3}
                            onChange={e => {
                              const newRows = cap(Math.floor(Number(e.target.value) || 1), 1, 20);
                              const cur = element.tableData || [];
                              const data = Array.from({ length: newRows }, (_, r) =>
                                Array.from({ length: element.tableCols || 3 }, (_, c) => cur[r]?.[c] || '')
                              );
                              patch({ tableRows: newRows, tableData: data });
                            }}
                          />
                        </label>
                        <label>
                          Cols
                          <input
                            type="number"
                            min={1}
                            max={10}
                            value={element.tableCols || 3}
                            onChange={e => {
                              const newCols = cap(Math.floor(Number(e.target.value) || 1), 1, 10);
                              const cur = element.tableData || [];
                              const data = Array.from({ length: element.tableRows || 3 }, (_, r) =>
                                Array.from({ length: newCols }, (_, c) => cur[r]?.[c] || '')
                              );
                              patch({ tableCols: newCols, tableData: data });
                            }}
                          />
                        </label>
                      </>
                    )}

                    {element.type === 'chart' && (
                      <>
                        <label>
                          Chart title
                          <input
                            type="text"
                            value={element.chartTitle || ''}
                            onChange={e => patch({ chartTitle: e.target.value })}
                          />
                        </label>
                        <label>
                          Chart type
                          <select
                            value={element.chartType || 'bar'}
                            onChange={e => patch({ chartType: e.target.value as any })}
                          >
                            <option value="bar">Bar Chart</option>
                            <option value="line">Line Chart</option>
                            <option value="pie">Pie Chart</option>
                          </select>
                        </label>
                      </>
                    )}
                    {element.type === 'table' && <fieldset style={{ gridColumn: '1 / -1', minWidth: 0 }}><legend>Table cells</legend>
                      {(element.tableData || []).map((row, r) => <div key={r} style={{ display: 'flex', gap: 4 }}>{row.map((value, c) => <input key={c} aria-label={`Table row ${r + 1} column ${c + 1}`} style={{ width: `${100 / row.length}%`, minWidth: 0 }} value={value} onChange={event => { const data = structuredClone(element.tableData!); data[r][c] = event.target.value; patch({ tableData: data }); }} />)}</div>)}
                    </fieldset>}
                    {element.type === 'chart' && <fieldset style={{ gridColumn: '1 / -1', minWidth: 0 }}><legend>Chart data</legend>
                      {(element.chartData || []).map((point, i) => <div key={i} style={{ display: 'flex', gap: 4 }}>
                        <input aria-label={`Chart label ${i + 1}`} style={{ width: '50%' }} value={point.label} onChange={event => patch({ chartData: element.chartData!.map((p, j) => j === i ? { ...p, label: event.target.value } : p) })} />
                        <input aria-label={`Chart value ${i + 1}`} style={{ width: '40%' }} type="number" value={point.value} onChange={event => { const value = Number(event.target.value); if (Number.isFinite(value)) patch({ chartData: element.chartData!.map((p, j) => j === i ? { ...p, value } : p) }); }} />
                        <button aria-label={`Remove chart point ${i + 1}`} onClick={() => patch({ chartData: element.chartData!.filter((_, j) => j !== i) })}>×</button>
                      </div>)}
                      <button className="secondary" disabled={(element.chartData?.length || 0) >= 100} onClick={() => patch({ chartData: [...(element.chartData || []), { label: 'Item', value: 0 }] })}>Add data point</button>
                    </fieldset>}
                  </div>

                  <div className="inspector-section">
                    <p className="inspector-kicker">POSITION & SIZE</p>
                    <div className="geometry">
                      {(['x', 'y', 'w', 'h'] as const).map(key => (
                        <label key={key}>
                          {{ x: 'Left', y: 'Top', w: 'Width', h: 'Height' }[key]}
                          <input
                            aria-label={`Object ${key}`}
                            type="number"
                            value={Math.round(element[key])}
                            onChange={e =>
                              patch({
                                [key]: cap(
                                  Number(e.target.value),
                                  key === 'w' || key === 'h' ? 1 : -1920,
                                  key === 'w' || key === 'x' ? 3840 : 2160
                                ),
                              })
                            }
                          />
                        </label>
                      ))}
                    </div>
                    <label>
                      Rotation
                      <input
                        aria-label="Object rotation"
                        type="number"
                        min={-360}
                        max={360}
                        value={element.rotation || 0}
                        onChange={e => patch({ rotation: cap(Number(e.target.value), -360, 360) })}
                      />
                    </label>
                  </div>

                  <div className="inspector-section">
                    <p className="inspector-kicker">ARRANGE</p>
                    <div className="arrange">
                      <button className="secondary" onClick={() => layer(true)}>
                        <Layers size={14} />Bring to front
                      </button>
                      <button className="secondary" onClick={() => layer(false)}>
                        Send to back
                      </button>
                      <button className="secondary" onClick={() => patch({ x: (WIDTH - element.w) / 2 })}>
                        Center horizontally
                      </button>
                      <button className="secondary" onClick={() => patch({ y: (HEIGHT - element.h) / 2 })}>
                        Center vertically
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <div className="inspector-section">
                  <p className="muted">A clear slide starts with one idea.</p>
                  <label>
                    Background
                    <input
                      type="color"
                      aria-label="Slide background inspector"
                      value={slide.background}
                      onChange={e => change(d => (d.slides[index].background = e.target.value))}
                    />
                  </label>
                  <button className="secondary" onClick={() => setDialog('help')}>
                    Keyboard shortcuts
                  </button>
                </div>
              )}
            </aside>
          </div>

          <footer className="editor-footer">
            <span>
              {deck.slides.length} slide{deck.slides.length === 1 ? '' : 's'}
            </span>
            <span>{slide.elements.length} objects</span>
            <span className="push">Slide Cloud · Local-first Office</span>
            <button onClick={() => setShowNotes(!showNotes)}>{showNotes ? 'Hide notes' : 'Show notes'}</button>
          </footer>
        </div>
      ) : (
        <div className="library-app">
          <aside className="sidebar">
            <Brand />
            <button className="primary new" onClick={() => void open(newDeck(), true)}>
              <Plus size={18} />New presentation
            </button>
            <p className="sidebar-label">WORKSPACE</p>
            <button className={`nav-item ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
              <LayoutTemplate size={16} />All presentations<span className="push">{decks.length}</span>
            </button>
            <button className={`nav-item ${filter === 'recent' ? 'active' : ''}`} onClick={() => setFilter('recent')}>
              <Clock size={16} />Recent
            </button>
            <button className={`nav-item ${filter === 'templates' ? 'active' : ''}`} onClick={() => setFilter('templates')}>
              <Layers size={16} />Templates
            </button>
            <button className="nav-item" onClick={() => void openFile()}>
              <FolderOpen size={16} />Open from computer
            </button>
            <div className="sidebar-bottom">
              <p>
                Your ideas. Your space.<small>Local first. Completely free.</small>
              </p>
              <button className="nav-item" onClick={() => setDialog('settings')}>
                <Settings size={16} />Settings & appearance
              </button>
              <small className="version">Slide Cloud · Development Edition</small>
            </div>
          </aside>

          <main className="library">
            <header className="topbar">
              <span>Your workspace</span>
              <label className="search">
                <Search size={15} />
                <input
                  aria-label="Search presentations"
                  placeholder="Search your presentations"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </label>
              <button className="icon" aria-label="Appearance settings" onClick={() => setDialog('settings')}>
                <Sun size={18} />
              </button>
            </header>
            <div className="library-content">
              <section className="welcome">
                <p className="eyebrow">A LITTLE CLARITY GOES A LONG WAY</p>
                <h1>Make your ideas matter.</h1>
                <p>A space to shape your story. A canvas to make it clear.</p>
              </section>
              <section>
                <div className="section-heading">
                  <h2>Start with a little structure</h2>
                  <span className="muted">Fully editable. Entirely yours.</span>
                </div>
                <div className="templates">
                  <button className="template" onClick={() => void open(newDeck(), true)}>
                    <div className="template-preview blank">
                      <Plus size={28} />
                    </div>
                    <strong>Blank presentation</strong>
                    <small>A clean beginning</small>
                  </button>
                  {templates.current.map(t => (
                    <button className="template" key={t.id} onClick={() => void open(templateDeck(t.id), true)}>
                      <div className={`template-preview ${t.id}`}>
                        <SlideView slide={t.deck.slides[0]} label={`${t.name} template preview`} />
                      </div>
                      <strong>{t.name}</strong>
                      <small>{t.description}</small>
                    </button>
                  ))}
                </div>
              </section>
              {filter !== 'templates' && (
                <section className="presentations">
                  <div className="section-heading">
                    <h2>
                      {filter === 'recent' ? 'Recently opened' : 'Your presentations'}
                      <span className="count">{decks.length}</span>
                    </h2>
                    <span className="muted">Last edited</span>
                  </div>
                  {decks.filter(d => d.name.toLowerCase().includes(query.toLowerCase())).slice(0, filter === 'recent' ? 10 : undefined).length ? (
                    <div className="deck-list">
                      {decks
                        .filter(d => d.name.toLowerCase().includes(query.toLowerCase()))
                        .slice(0, filter === 'recent' ? 10 : undefined)
                        .map(d => (
                          <div className="deck-row" key={d.id}>
                            <button className="deck-open" onClick={() => void open(d)}>
                              <SlideView slide={d.slides[0]} label="" />
                              <span>
                                <strong>{d.name || 'Untitled presentation'}</strong>
                                <small>{d.slides.length} slides · Saved on this device</small>
                              </span>
                            </button>
                            <time>
                              {new Date(d.updatedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            </time>
                            <button
                              className="icon"
                              aria-label={`Duplicate ${d.name}`}
                              onClick={() => {
                                const copy = clone(d);
                                copy.id = crypto.randomUUID();
                                copy.name = (d.name + ' copy').slice(0, 240);
                                void open(copy, true);
                              }}
                            >
                              <Copy size={15} />
                            </button>
                            <button
                              className="icon"
                              aria-label={`Delete ${d.name}`}
                              onClick={() => {
                                setDeleteId(d.id);
                                setDialog('delete');
                              }}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                    </div>
                  ) : (
                    <div className="empty">
                      <div className="empty-icon">
                        <Play size={23} />
                      </div>
                      <h3>{query ? 'No presentations found' : 'Your next idea starts here.'}</h3>
                      <p>{query ? 'Try a different search.' : 'Create a presentation or bring one from your computer.'}</p>
                      <button className="secondary" onClick={() => void openFile()}>
                        <FolderOpen size={14} />Open a presentation
                      </button>
                    </div>
                  )}
                </section>
              )}
              <footer className="workspace-footer">
                <Check size={13} />No accounts. No subscriptions. Your work stays with you.
                <span className="push">Part of the BlueCloud family.</span>
              </footer>
            </div>
          </main>
        </div>
      )}

      {dialog && (
        <Modal
          title={
            {
              file: 'Your presentation',
              history: 'Presentation history',
              settings: 'Make yourself at home',
              pptx: 'Export to PowerPoint',
              help: 'Helpful shortcuts',
              delete: 'Delete presentation?',
              'export-svg': 'Export current slide',
            }[dialog]
          }
          close={() => setDialog(null)}
        >
          {dialog === 'file' && (
            <>
              <p className="note">
                Native backups preserve all content, shapes, tables, charts and versions. PPTX export generates OOXML presentations.
              </p>
              {deck?.importWarnings?.length ? (
                <details className="import-notes">
                  <summary>Import notes ({deck.importWarnings.length})</summary>
                  <ul>
                    {deck.importWarnings.map((warning, i) => (
                      <li key={i}>{warning}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
              <div className="file-options">
                <button onClick={() => void saveFile()}>
                  <Save size={18} />
                  <span>
                    <strong>Save native backup</strong>
                    <small>.slidecloud · Full fidelity</small>
                  </span>
                </button>
                <button onClick={() => void saveFile(true)}>
                  <Copy size={18} />
                  <span>
                    <strong>Save As</strong>
                    <small>Choose another destination</small>
                  </span>
                </button>
                <button onClick={() => setDialog('pptx')}>
                  <Download size={18} />
                  <span>
                    <strong>Export PowerPoint</strong>
                    <small>.pptx · Editable text, shapes, tables and notes</small>
                  </span>
                </button>
                <button
                  onClick={() => {
                    setDialog(null);
                    window.setTimeout(() => window.print(), 100);
                  }}
                >
                  <Monitor size={18} />
                  <span>
                    <strong>Print / Save as PDF</strong>
                    <small>Slides only</small>
                  </span>
                </button>
                <button onClick={() => void openFile()}>
                  <FolderOpen size={18} />
                  <span>
                    <strong>Open a presentation</strong>
                    <small>.slidecloud or .pptx</small>
                  </span>
                </button>
                <button onClick={() => void restoreOriginal()}>
                  <Download size={18} />
                  <span>
                    <strong>Retrieve original PPTX</strong>
                    <small>Download untouched imported file</small>
                  </span>
                </button>
              </div>
            </>
          )}

          {dialog === 'pptx' && (
            <>
              <p>Export editable PowerPoint slides with formatted text, shapes, tables, and speaker notes.</p>
              <button className="primary" onClick={() => void exportPowerPoint()}>
                Export .pptx
              </button>
            </>
          )}

          {dialog === 'settings' && (
            <>
              <p className="note">A familiar workspace, in the light that suits you.</p>
              <div className="appearance-options">
                {[
                  ['light', 'Light', Sun],
                  ['dark', 'Dark', Moon],
                  ['system', 'System', Monitor],
                ].map(([val, lbl, Icon]) => {
                  const Symbol = Icon as typeof Sun;
                  return (
                    <button
                      key={String(val)}
                      className={appearance === val ? 'active' : ''}
                      onClick={() => setAppearance(String(val))}
                    >
                      <Symbol size={22} />
                      {String(lbl)}
                    </button>
                  );
                })}
              </div>
              <div className="settings-note">
                <strong>Made for your own space.</strong>
                <p>Presentations stay in your local library. No external sync service or account required.</p>
              </div>
            </>
          )}

          {dialog === 'history' && deck && (
            <>
              <p className="note">Save named versions on this device.</p>
              <form
                className="version-form"
                onSubmit={e => {
                  e.preventDefault();
                  if (!versionName.trim()) return;
                  change(d => {
                    d.versions = [
                      ...(d.versions || []).slice(-29),
                      {
                        id: crypto.randomUUID(),
                        name: versionName.trim().slice(0, 240),
                        at: new Date().toISOString(),
                        slides: clone(d.slides),
                      },
                    ];
                  });
                  setVersionName('');
                }}
              >
                <input
                  aria-label="Version name"
                  placeholder="Name this version"
                  maxLength={240}
                  value={versionName}
                  onChange={e => setVersionName(e.target.value)}
                />
                <button className="primary" disabled={!versionName.trim()}>
                  Save version
                </button>
              </form>
              {[...(deck.versions || [])].reverse().map(v => (
                <div key={v.id} className="version-row">
                  <div>
                    <strong>{v.name}</strong>
                    <small>{new Date(v.at).toLocaleString()}</small>
                  </div>
                  <button
                    className="secondary"
                    onClick={() => {
                      change(d => {
                        d.versions = [
                          ...d.versions.slice(-29),
                          {
                            id: crypto.randomUUID(),
                            name: 'Before restoring ' + v.name,
                            at: new Date().toISOString(),
                            slides: clone(d.slides),
                          },
                        ];
                        d.slides = clone(v.slides);
                      });
                      setIndex(0);
                      setSelected(null);
                      setDialog(null);
                      setMessage('Version restored.');
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
            </>
          )}

          {dialog === 'help' && (
            <>
              <div className="shortcuts">
                {[
                  ['Save native copy', 'Ctrl / ⌘ S'],
                  ['Save As', 'Ctrl / ⌘ Shift S'],
                  ['Undo / Redo', 'Ctrl / ⌘ Z · Shift Z'],
                  ['Duplicate selection', 'Ctrl / ⌘ D'],
                  ['Slideshow', 'F5'],
                  ['Presenter View', 'Shift + F5'],
                  ['Navigate', '← → · Space'],
                  ['Clear / Exit', 'Esc'],
                ].map(([label, key]) => (
                  <div key={label}>
                    <span>{label}</span>
                    <kbd>{key}</kbd>
                  </div>
                ))}
              </div>
            </>
          )}

          {dialog === 'delete' && (
            <>
              <p>Delete this presentation from this device?</p>
              <div className="dialog-actions">
                <button className="secondary" onClick={() => setDialog(null)}>
                  Keep
                </button>
                <button
                  className="danger"
                  onClick={() =>
                    void task('Removing local presentation', async () => {
                      await store.remove(deleteId);
                      setDialog(null);
                      await reload();
                    })
                  }
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </Modal>
      )}

      {/* Audience Fullscreen Slideshow */}
      {presenting && deck && slide && (
        <ShowDialog close={endShow}>
          <button className="show-exit" aria-label="Exit slideshow" onClick={endShow}>
            <X size={20} />Exit
          </button>
          <button
            className="show-fullscreen"
            onClick={() =>
              void document.documentElement
                .requestFullscreen()
                .catch(() => setMessage('Fullscreen is unavailable. Slideshow remains open.'))
            }
          >
            <Maximize2 size={16} />Fullscreen
          </button>
          <div className="show-slide">
            <SlideView slide={slide} animate label={`Audience slide ${index + 1}`} />
          </div>
          <div className="show-controls">
            <button aria-label="Previous slide" disabled={index === 0} onClick={() => setIndex(index - 1)}>
              <ChevronLeft size={22} />
            </button>
            <span>
              {index + 1} / {deck.slides.length}
            </span>
            <button
              aria-label="Next slide"
              disabled={index === deck.slides.length - 1}
              onClick={() => setIndex(index + 1)}
            >
              <ChevronRight size={22} />
            </button>
          </div>
        </ShowDialog>
      )}

      {/* Presenter View Console */}
      {presenterView && deck && slide && (
        <ShowDialog close={endShow}>
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', background: '#1c1b1f', padding: 24, gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #332f3b', paddingBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                <span style={{ fontSize: 20, fontWeight: 'bold', color: '#ffad7b' }}>Slide {index + 1} of {deck.slides.length}</span>
                <span style={{ fontSize: 16, background: '#2d2738', padding: '4px 12px', borderRadius: 6, color: '#fff' }}>
                  ⏱ {formatTimer(elapsedSecs)}
                </span>
                <button
                  style={{ background: '#3b324a', color: '#fff', border: 0, padding: '4px 8px', borderRadius: 4 }}
                  onClick={() => setTimerRunning(!timerRunning)}
                >
                  {timerRunning ? 'Pause' : 'Resume'}
                </button>
                <button
                  style={{ background: '#3b324a', color: '#fff', border: 0, padding: '4px 8px', borderRadius: 4 }}
                  onClick={() => setElapsedSecs(0)}
                >
                  Reset
                </button>
              </div>
              <button
                style={{ background: '#a63022', color: '#fff', border: 0, padding: '6px 14px', borderRadius: 6, cursor: 'pointer' }}
                onClick={endShow}
              >
                Exit Presenter View (Esc)
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '60% 40%', flex: 1, gap: 20, minHeight: 0 }}>
              {/* Main audience slide */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12, color: '#aaa' }}>CURRENT SLIDE (AUDIENCE)</span>
                <div style={{ flex: 1, border: '2px solid #ffad7b', borderRadius: 8, overflow: 'hidden', background: '#000' }}>
                  <SlideView slide={slide} />
                </div>
              </div>

              {/* Next slide & private notes */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minHeight: 0 }}>
                <div>
                  <span style={{ fontSize: 12, color: '#aaa' }}>NEXT SLIDE</span>
                  <div style={{ height: 160, border: '1px solid #443e50', borderRadius: 6, overflow: 'hidden', background: '#000' }}>
                    {index < deck.slides.length - 1 ? (
                      <SlideView slide={deck.slides[index + 1]} />
                    ) : (
                      <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#666' }}>End of presentation</div>
                    )}
                  </div>
                </div>

                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <span style={{ fontSize: 12, color: '#aaa', marginBottom: 4 }}>SPEAKER NOTES (PRIVATE)</span>
                  <div style={{ flex: 1, background: '#25212c', border: '1px solid #3c3447', borderRadius: 6, padding: 14, overflowY: 'auto', fontSize: 16, lineHeight: 1.6, color: '#f0ece7', whiteSpace: 'pre-wrap' }}>
                    {slide.notes || <em style={{ color: '#666' }}>No speaker notes for this slide.</em>}
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: 20, paddingTop: 10 }}>
              <button
                style={{ background: '#362f42', color: '#fff', border: 0, padding: '8px 24px', borderRadius: 6, cursor: 'pointer' }}
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                ◀ Previous Slide
              </button>
              <button
                style={{ background: '#ffad7b', color: '#201810', fontWeight: 'bold', border: 0, padding: '8px 24px', borderRadius: 6, cursor: 'pointer' }}
                disabled={index === deck.slides.length - 1}
                onClick={() => setIndex(index + 1)}
              >
                Next Slide ▶
              </button>
            </div>
          </div>
        </ShowDialog>
      )}

      {deck && (
        <div className="print-deck" aria-hidden="true">
          {deck.slides.map(s => (
            <section className="print-slide" key={s.id}>
              <SlideView slide={s} />
            </section>
          ))}
        </div>
      )}
      {banner}
    </>
  );
}
