import { useState, useEffect, useRef, useCallback, useMemo, CSSProperties, PointerEvent as ReactPointerEvent } from 'react';
import {
  Plus,
  ChevronLeft,
  PenLine,
  Search,
  Trash2,
  Edit3,
  Check,
  Eraser,
  Undo2,
  Type,
  Palette,
  RotateCcw,
} from 'lucide-react';

const SERIF = '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif';
const SANS = '"Pretendard", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const BG = '#f6f1e7';
const STORAGE_KEY = 'munjang.archive';

const FONTS: { id: string; label: string; family: string }[] = [
  { id: 'serif', label: '명조', family: SERIF },
  { id: 'sans', label: '고딕', family: SANS },
  { id: 'pen', label: '펜글씨', family: '"Nanum Pen Script", cursive' },
  { id: 'gowun', label: '고운', family: '"Gowun Dodum", sans-serif' },
  { id: 'gaegu', label: '개구', family: '"Gaegu", cursive' },
  { id: 'melody', label: '멜로디', family: '"Hi Melody", cursive' },
];

const CHAR_COLORS = ['#1c1917', '#78716c', '#b45309', '#b91c1c', '#1d4ed8', '#15803d'];
const PEN_COLORS = ['#1c1917', '#57534e', '#b91c1c', '#c2410c', '#a16207', '#1d4ed8', '#15803d', '#a21caf'];
const PEN_SIZES = [1.5, 3, 6, 10];

const PAPERS: { id: PaperKind; label: string }[] = [
  { id: 'plain', label: '무지' },
  { id: 'lined', label: '줄' },
  { id: 'grid', label: '모눈' },
  { id: 'dot', label: '점' },
  { id: 'hanji', label: '한지' },
];

type PaperKind = 'plain' | 'lined' | 'grid' | 'dot' | 'hanji';

type CharStyle = {
  fontId?: string;
  sizeScale?: number;
  color?: string;
};

type Sentence = {
  id: string;
  text: string;
  title: string;
  author: string;
  page: string;
  tags: string[];
  thoughts: string;
  createdAt: string;
  transcribed: boolean;
  transcribedAt?: string;
  charStyles?: Record<number, CharStyle>;
  drawing?: string;
  paper?: PaperKind;
};

type NewSentenceInput = Pick<Sentence, 'text' | 'title' | 'author' | 'page' | 'tags'>;
type View = 'archive' | 'add' | 'detail' | 'transcribe';

type Point = { x: number; y: number; p: number };
type Stroke = { tool: 'pen' | 'eraser'; color: string; size: number; points: Point[] };

function loadSentences(): Sentence[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Sentence[]) : [];
  } catch {
    return [];
  }
}

function saveSentences(data: Sentence[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.error(e);
  }
}

export default function App() {
  const [view, setView] = useState<View>('archive');
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setSentences(loadSentences());
    setLoading(false);
  }, []);

  const persist = (data: Sentence[]) => {
    setSentences(data);
    saveSentences(data);
  };

  const addSentence = (data: NewSentenceInput) => {
    const newOne: Sentence = {
      id: Date.now().toString(),
      ...data,
      thoughts: '',
      createdAt: new Date().toISOString(),
      transcribed: false,
    };
    persist([newOne, ...sentences]);
    setView('archive');
  };

  const updateOne = (id: string, updates: Partial<Sentence>) => {
    persist(sentences.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteOne = (id: string) => {
    persist(sentences.filter((s) => s.id !== id));
    setSelectedId(null);
    setView('archive');
  };

  const selected = sentences.find((s) => s.id === selectedId);

  const filtered = searchQuery
    ? sentences.filter(
        (s) =>
          s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
          (s.author || '').toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : sentences;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="text-stone-400" style={{ fontFamily: SANS }}>불러오는 중…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: BG, fontFamily: SERIF }}>
      {view === 'archive' && (
        <ArchiveView
          sentences={filtered}
          totalCount={sentences.length}
          onAdd={() => setView('add')}
          onSelect={(id) => {
            setSelectedId(id);
            setView('detail');
          }}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
      )}
      {view === 'add' && <AddView onSave={addSentence} onCancel={() => setView('archive')} />}
      {view === 'detail' && selected && (
        <DetailView
          sentence={selected}
          onBack={() => setView('archive')}
          onTranscribe={() => setView('transcribe')}
          onUpdate={(updates) => updateOne(selected.id, updates)}
          onDelete={() => deleteOne(selected.id)}
        />
      )}
      {view === 'transcribe' && selected && (
        <TranscribeView
          sentence={selected}
          onBack={() => setView('detail')}
          onComplete={(payload) =>
            updateOne(selected.id, {
              transcribed: true,
              transcribedAt: new Date().toISOString(),
              ...payload,
            })
          }
        />
      )}
    </div>
  );
}

type ArchiveViewProps = {
  sentences: Sentence[];
  totalCount: number;
  onAdd: () => void;
  onSelect: (id: string) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
};

function ArchiveView({ sentences, totalCount, onAdd, onSelect, searchQuery, setSearchQuery }: ArchiveViewProps) {
  const [showSearch, setShowSearch] = useState(false);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 pb-32">
      <header className="mb-12 flex items-end justify-between">
        <div>
          <h1 className="text-4xl text-stone-800 mb-2" style={{ letterSpacing: '0.08em' }}>문장</h1>
          <p className="text-sm text-stone-500" style={{ fontFamily: SANS }}>
            {totalCount === 0 ? '오늘 한 문장을 모아볼까요' : `${totalCount}개의 문장을 모았어요`}
          </p>
        </div>
        <button
          onClick={() => {
            setShowSearch(!showSearch);
            if (showSearch) setSearchQuery('');
          }}
          className="text-stone-500 hover:text-stone-800 transition-colors p-2"
          aria-label="검색"
        >
          <Search size={20} />
        </button>
      </header>

      {showSearch && (
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="문장이나 책 제목 검색…"
          className="w-full mb-8 px-4 py-3 bg-white/60 border border-stone-200 rounded-lg text-stone-800 placeholder-stone-400 focus:outline-none focus:border-stone-400"
          style={{ fontFamily: SANS }}
          autoFocus
        />
      )}

      {sentences.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-stone-500 mb-3 text-lg" style={{ wordBreak: 'keep-all' }}>
            아직 모은 문장이 없어요
          </p>
          <p className="text-stone-400 text-sm" style={{ fontFamily: SANS }}>
            마음에 닿은 한 문장부터, 천천히
          </p>
        </div>
      ) : (
        <div className="space-y-5">
          {sentences.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="w-full text-left bg-white/70 hover:bg-white border border-stone-200/70 rounded-lg p-7 transition-all hover:shadow-sm"
            >
              <p className="text-stone-800 text-lg leading-loose mb-5" style={{ wordBreak: 'keep-all' }}>
                {s.text.length > 140 ? s.text.slice(0, 140) + '…' : s.text}
              </p>
              <div className="flex items-center justify-between text-xs text-stone-500" style={{ fontFamily: SANS }}>
                <span>
                  {s.title && <span className="italic">『{s.title}』</span>}
                  {s.author && <span> · {s.author}</span>}
                  {!s.title && !s.author && <span className="text-stone-400">출처 없음</span>}
                </span>
                {s.transcribed && (
                  <span className="flex items-center gap-1 text-stone-400">
                    <PenLine size={11} /> 필사함
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}

      <button
        onClick={onAdd}
        className="fixed bottom-8 right-8 w-14 h-14 bg-stone-800 hover:bg-stone-900 text-stone-100 rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label="문장 추가"
      >
        <Plus size={22} />
      </button>
    </div>
  );
}

type AddViewProps = {
  onSave: (data: NewSentenceInput) => void;
  onCancel: () => void;
};

function AddView({ onSave, onCancel }: AddViewProps) {
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [page, setPage] = useState('');
  const [tags, setTags] = useState('');

  const handleSave = () => {
    if (!text.trim()) return;
    onSave({
      text: text.trim(),
      title: title.trim(),
      author: author.trim(),
      page: page.trim(),
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
    });
  };

  const inputCls =
    'w-full bg-transparent border-b border-stone-300 focus:border-stone-700 outline-none text-stone-800 py-2 transition-colors';

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <header className="flex items-center justify-between mb-12" style={{ fontFamily: SANS }}>
        <button onClick={onCancel} className="text-stone-500 hover:text-stone-800 transition-colors text-sm">
          취소
        </button>
        <h2 className="text-stone-600 text-sm">새 문장</h2>
        <button
          onClick={handleSave}
          disabled={!text.trim()}
          className="text-stone-800 hover:text-black disabled:text-stone-300 disabled:cursor-not-allowed text-sm transition-colors"
        >
          저장
        </button>
      </header>

      <div className="space-y-10">
        <div>
          <label className="block text-xs text-stone-500 mb-3 tracking-wide" style={{ fontFamily: SANS }}>문장</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="마음에 닿은 문장을 적어주세요"
            rows={5}
            className="w-full bg-transparent border-b border-stone-300 focus:border-stone-700 outline-none resize-none text-stone-800 text-lg leading-loose py-2 placeholder-stone-300 transition-colors"
            style={{ wordBreak: 'keep-all' }}
            autoFocus
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-stone-500 mb-3 tracking-wide" style={{ fontFamily: SANS }}>책 제목</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-3 tracking-wide" style={{ fontFamily: SANS }}>저자</label>
            <input type="text" value={author} onChange={(e) => setAuthor(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-xs text-stone-500 mb-3 tracking-wide" style={{ fontFamily: SANS }}>페이지 (선택)</label>
            <input type="text" value={page} onChange={(e) => setPage(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-3 tracking-wide" style={{ fontFamily: SANS }}>태그 (쉼표로 구분)</label>
            <input
              type="text"
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="에세이, 위로"
              className={inputCls + ' placeholder-stone-300'}
              style={{ fontFamily: SANS }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

type DetailViewProps = {
  sentence: Sentence;
  onBack: () => void;
  onTranscribe: () => void;
  onUpdate: (updates: Partial<Sentence>) => void;
  onDelete: () => void;
};

function DetailView({ sentence, onBack, onTranscribe, onUpdate, onDelete }: DetailViewProps) {
  const [thoughts, setThoughts] = useState(sentence.thoughts || '');
  const [editingThoughts, setEditingThoughts] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setThoughts(sentence.thoughts || '');
    setEditingThoughts(false);
  }, [sentence.id, sentence.thoughts]);

  const saveThoughts = () => {
    onUpdate({ thoughts });
    setEditingThoughts(false);
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 pb-32">
      <header className="flex items-center justify-between mb-16" style={{ fontFamily: SANS }}>
        <button onClick={onBack} className="text-stone-500 hover:text-stone-800 flex items-center gap-1 transition-colors text-sm">
          <ChevronLeft size={18} /> 목록
        </button>
        {confirmDelete ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-stone-600">삭제할까요?</span>
            <button onClick={() => setConfirmDelete(false)} className="text-stone-500">취소</button>
            <button onClick={onDelete} className="text-red-600">삭제</button>
          </div>
        ) : (
          <button onClick={() => setConfirmDelete(true)} className="text-stone-400 hover:text-red-600 transition-colors p-1">
            <Trash2 size={16} />
          </button>
        )}
      </header>

      <div className="mb-12">
        <StyledSentence text={sentence.text} charStyles={sentence.charStyles} baseSize={24} />
      </div>

      <div className="mb-16 text-sm text-stone-500 space-y-2" style={{ fontFamily: SANS }}>
        {(sentence.title || sentence.author || sentence.page) && (
          <p>
            {sentence.title && <span className="italic">『{sentence.title}』</span>}
            {sentence.author && <span> · {sentence.author}</span>}
            {sentence.page && <span> · p.{sentence.page}</span>}
          </p>
        )}
        <p className="text-stone-400">기록한 날 · {formatDate(sentence.createdAt)}</p>
        {sentence.transcribed && sentence.transcribedAt && (
          <p className="text-stone-400">필사한 날 · {formatDate(sentence.transcribedAt)}</p>
        )}
        {sentence.tags && sentence.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2">
            {sentence.tags.map((t, i) => (
              <span key={i} className="text-xs px-2.5 py-1 bg-stone-200/60 text-stone-600 rounded-full">#{t}</span>
            ))}
          </div>
        )}
      </div>

      {sentence.drawing && (
        <div className="mb-12">
          <h3 className="text-sm text-stone-500 tracking-wide mb-4" style={{ fontFamily: SANS }}>필사한 글씨</h3>
          <div className="rounded-lg overflow-hidden border border-stone-200 bg-white">
            <img src={sentence.drawing} alt="필사" className="w-full block" />
          </div>
        </div>
      )}

      <div className="mb-12 pt-8 border-t border-stone-200">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm text-stone-500 tracking-wide" style={{ fontFamily: SANS }}>나의 생각</h3>
          {!editingThoughts && (
            <button onClick={() => setEditingThoughts(true)} className="text-stone-400 hover:text-stone-800 transition-colors p-1">
              <Edit3 size={14} />
            </button>
          )}
        </div>
        {editingThoughts ? (
          <div>
            <textarea
              value={thoughts}
              onChange={(e) => setThoughts(e.target.value)}
              rows={5}
              placeholder="이 문장이 왜 마음에 닿았나요?"
              className="w-full bg-white/60 border border-stone-200 rounded-lg p-4 text-stone-800 outline-none focus:border-stone-400 resize-none leading-relaxed"
              style={{ wordBreak: 'keep-all' }}
              autoFocus
            />
            <div className="flex justify-end gap-4 mt-3 text-sm" style={{ fontFamily: SANS }}>
              <button
                onClick={() => {
                  setThoughts(sentence.thoughts || '');
                  setEditingThoughts(false);
                }}
                className="text-stone-500 hover:text-stone-800 transition-colors"
              >
                취소
              </button>
              <button onClick={saveThoughts} className="text-stone-800 hover:text-black transition-colors">저장</button>
            </div>
          </div>
        ) : (
          <p className="text-stone-700 leading-loose whitespace-pre-wrap" style={{ wordBreak: 'keep-all' }}>
            {thoughts || <span className="text-stone-400" style={{ fontFamily: SANS }}>아직 비어 있어요</span>}
          </p>
        )}
      </div>

      <button
        onClick={onTranscribe}
        className="w-full py-4 bg-stone-800 hover:bg-stone-900 text-stone-100 rounded-lg flex items-center justify-center gap-2 transition-colors"
        style={{ fontFamily: SANS }}
      >
        <PenLine size={18} />
        {sentence.transcribed ? '다시 필사하기' : '필사하기'}
      </button>
    </div>
  );
}

function StyledSentence({
  text,
  charStyles,
  baseSize,
  onCharTap,
  selectedIndex,
}: {
  text: string;
  charStyles?: Record<number, CharStyle>;
  baseSize: number;
  onCharTap?: (index: number) => void;
  selectedIndex?: number | null;
}) {
  return (
    <p className="leading-loose" style={{ wordBreak: 'keep-all' }}>
      {Array.from(text).map((ch, i) => {
        const st = charStyles?.[i];
        const fontFamily = FONTS.find((f) => f.id === (st?.fontId ?? 'serif'))?.family ?? SERIF;
        const size = baseSize * (st?.sizeScale ?? 1);
        const color = st?.color ?? '#292524';
        const isWhitespace = ch === ' ' || ch === '\n';
        const isSelected = selectedIndex === i;
        return (
          <span
            key={i}
            onClick={onCharTap && !isWhitespace ? () => onCharTap(i) : undefined}
            style={{
              fontFamily,
              fontSize: `${size}px`,
              color,
              cursor: onCharTap && !isWhitespace ? 'pointer' : 'default',
              backgroundColor: isSelected ? 'rgba(120, 113, 108, 0.18)' : undefined,
              borderRadius: 4,
              padding: isSelected ? '0 2px' : undefined,
              transition: 'background-color 120ms',
              whiteSpace: ch === '\n' ? 'pre' : undefined,
              display: 'inline',
            }}
          >
            {ch}
          </span>
        );
      })}
    </p>
  );
}

type TranscribeViewProps = {
  sentence: Sentence;
  onBack: () => void;
  onComplete: (payload: { drawing?: string; charStyles?: Record<number, CharStyle>; paper?: PaperKind }) => void;
};

function TranscribeView({ sentence, onBack, onComplete }: TranscribeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]);
  const [penSize, setPenSize] = useState<number>(PEN_SIZES[1]);
  const [paper, setPaper] = useState<PaperKind>(sentence.paper ?? 'plain');
  const [penOnly, setPenOnly] = useState<boolean>(true);
  const [charStyles, setCharStyles] = useState<Record<number, CharStyle>>(sentence.charStyles ?? {});
  const [editingChar, setEditingChar] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 800, h: 480 });

  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(320, Math.floor(Math.min(window.innerHeight * 0.55, w * 0.7)));
      setCanvasSize({ w, h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const all = currentStrokeRef.current ? [...strokes, currentStrokeRef.current] : strokes;
    for (const s of all) {
      if (s.points.length === 0) continue;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
      ctx.strokeStyle = s.color;
      if (s.points.length === 1) {
        const p = s.points[0];
        ctx.beginPath();
        ctx.arc(p.x, p.y, (s.size * (0.6 + p.p * 0.6)) / 2, 0, Math.PI * 2);
        ctx.fillStyle = s.color;
        ctx.fill();
        continue;
      }
      for (let i = 1; i < s.points.length; i++) {
        const a = s.points[i - 1];
        const b = s.points[i];
        const w = s.size * (0.6 + ((a.p + b.p) / 2) * 0.6);
        ctx.lineWidth = w;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }, [strokes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = canvasSize.w * ratio;
    canvas.height = canvasSize.h * ratio;
    canvas.style.width = `${canvasSize.w}px`;
    canvas.style.height = `${canvasSize.h}px`;
    drawAll();
  }, [canvasSize, drawAll]);

  useEffect(() => {
    drawAll();
  }, [drawAll]);

  const getPos = (e: ReactPointerEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pressure > 0 ? e.pressure : 0.5,
    };
  };

  const shouldDraw = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!penOnly) return true;
    return e.pointerType === 'pen' || e.pointerType === 'mouse';
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!shouldDraw(e)) return;
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const p = getPos(e);
    currentStrokeRef.current = {
      tool,
      color: tool === 'pen' ? penColor : '#000000',
      size: tool === 'pen' ? penSize : penSize * 3,
      points: [p],
    };
    drawAll();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    if (!shouldDraw(e)) return;
    const p = getPos(e);
    currentStrokeRef.current.points.push(p);
    drawAll();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!currentStrokeRef.current) return;
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setStrokes((prev) => [...prev, finished]);
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const undo = () => setStrokes((prev) => prev.slice(0, -1));
  const clearAll = () => setStrokes([]);

  const handleComplete = () => {
    const src = canvasRef.current;
    let drawing: string | undefined;
    if (src && strokes.length > 0) {
      const out = document.createElement('canvas');
      out.width = canvasSize.w;
      out.height = canvasSize.h;
      const octx = out.getContext('2d')!;
      paintPaper(octx, paper, canvasSize.w, canvasSize.h);
      octx.drawImage(src, 0, 0, canvasSize.w, canvasSize.h);
      drawing = out.toDataURL('image/png');
    }
    onComplete({ drawing, charStyles, paper });
    setDone(true);
    setTimeout(() => onBack(), 1400);
  };

  const updateCharStyle = (i: number, patch: Partial<CharStyle>) => {
    setCharStyles((prev) => ({ ...prev, [i]: { ...prev[i], ...patch } }));
  };

  const resetCharStyle = (i: number) => {
    setCharStyles((prev) => {
      const next = { ...prev };
      delete next[i];
      return next;
    });
  };

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: BG }}>
        <div className="text-center">
          <p className="text-stone-700 text-xl mb-2" style={{ wordBreak: 'keep-all' }}>한 문장, 잘 따라 적었어요</p>
          <p className="text-stone-400 text-sm" style={{ fontFamily: SANS }}>오늘도 수고했어요</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-3xl mx-auto w-full px-6 py-8 flex items-center justify-between" style={{ fontFamily: SANS }}>
        <button onClick={onBack} className="text-stone-500 hover:text-stone-800 flex items-center gap-1 transition-colors text-sm">
          <ChevronLeft size={18} /> 돌아가기
        </button>
        <div className="flex items-center gap-3 text-xs text-stone-500">
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={penOnly}
              onChange={(e) => setPenOnly(e.target.checked)}
              className="accent-stone-700"
            />
            펜으로만
          </label>
          <button
            onClick={handleComplete}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 text-stone-100 rounded-full text-sm flex items-center gap-1.5"
          >
            <Check size={14} /> 다 적었어요
          </button>
        </div>
      </header>

      <div className="max-w-3xl mx-auto w-full px-6 pb-32">
        <div className="mb-8">
          <p className="text-xs text-stone-400 mb-4 tracking-widest" style={{ fontFamily: SANS }}>
            따라 적을 문장 · 글씨를 눌러 꾸며보세요
          </p>
          <StyledSentence
            text={sentence.text}
            charStyles={charStyles}
            baseSize={22}
            onCharTap={(i) => setEditingChar(i === editingChar ? null : i)}
            selectedIndex={editingChar}
          />
          {editingChar !== null && (
            <CharStylePicker
              ch={Array.from(sentence.text)[editingChar] ?? ''}
              style={charStyles[editingChar] ?? {}}
              onChange={(patch) => updateCharStyle(editingChar, patch)}
              onReset={() => resetCharStyle(editingChar)}
              onClose={() => setEditingChar(null)}
            />
          )}
        </div>

        <div>
          <p className="text-xs text-stone-400 mb-3 tracking-widest" style={{ fontFamily: SANS }}>나의 필사</p>
          <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-stone-200" style={{ background: '#fff' }}>
            <PaperBackground kind={paper} width={canvasSize.w} height={canvasSize.h} />
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="block relative"
              style={{ touchAction: 'none', cursor: tool === 'eraser' ? 'cell' : 'crosshair' }}
            />
          </div>

          <Toolbar
            tool={tool}
            setTool={setTool}
            penColor={penColor}
            setPenColor={setPenColor}
            penSize={penSize}
            setPenSize={setPenSize}
            paper={paper}
            setPaper={setPaper}
            onUndo={undo}
            onClear={clearAll}
            canUndo={strokes.length > 0}
          />
        </div>
      </div>
    </div>
  );
}

function CharStylePicker({
  ch,
  style,
  onChange,
  onReset,
  onClose,
}: {
  ch: string;
  style: CharStyle;
  onChange: (patch: Partial<CharStyle>) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <div className="mt-4 bg-white border border-stone-200 rounded-lg p-4 shadow-sm" style={{ fontFamily: SANS }}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-stone-500">
          <span className="mr-2 text-stone-800 text-base">「{ch}」</span> 글씨 꾸미기
        </span>
        <div className="flex items-center gap-3 text-xs">
          <button onClick={onReset} className="text-stone-500 hover:text-stone-800 flex items-center gap-1">
            <RotateCcw size={12} /> 초기화
          </button>
          <button onClick={onClose} className="text-stone-500 hover:text-stone-800">닫기</button>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <p className="text-[10px] text-stone-400 tracking-widest mb-1.5 flex items-center gap-1"><Type size={11} /> 폰트</p>
          <div className="flex flex-wrap gap-1.5">
            {FONTS.map((f) => {
              const active = (style.fontId ?? 'serif') === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => onChange({ fontId: f.id })}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    active ? 'border-stone-800 bg-stone-800 text-stone-50' : 'border-stone-200 text-stone-600 hover:border-stone-400'
                  }`}
                  style={{ fontFamily: f.family }}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-stone-400 tracking-widest mb-1.5">크기</p>
          <div className="flex gap-1.5">
            {[0.75, 1, 1.4, 1.8].map((s) => {
              const active = (style.sizeScale ?? 1) === s;
              return (
                <button
                  key={s}
                  onClick={() => onChange({ sizeScale: s })}
                  className={`px-2.5 py-1 rounded-md text-xs border ${
                    active ? 'border-stone-800 bg-stone-800 text-stone-50' : 'border-stone-200 text-stone-600 hover:border-stone-400'
                  }`}
                >
                  {s === 1 ? '기본' : `${s}x`}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <p className="text-[10px] text-stone-400 tracking-widest mb-1.5 flex items-center gap-1"><Palette size={11} /> 색</p>
          <div className="flex gap-1.5">
            {CHAR_COLORS.map((c) => {
              const active = (style.color ?? '#292524') === c;
              return (
                <button
                  key={c}
                  onClick={() => onChange({ color: c })}
                  className={`w-7 h-7 rounded-full border-2 ${active ? 'border-stone-800' : 'border-stone-200'}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function Toolbar({
  tool,
  setTool,
  penColor,
  setPenColor,
  penSize,
  setPenSize,
  paper,
  setPaper,
  onUndo,
  onClear,
  canUndo,
}: {
  tool: 'pen' | 'eraser';
  setTool: (t: 'pen' | 'eraser') => void;
  penColor: string;
  setPenColor: (c: string) => void;
  penSize: number;
  setPenSize: (s: number) => void;
  paper: PaperKind;
  setPaper: (p: PaperKind) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
}) {
  return (
    <div className="mt-4 bg-white/80 border border-stone-200 rounded-lg p-3 space-y-3" style={{ fontFamily: SANS }}>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex border border-stone-200 rounded-md overflow-hidden">
          <button
            onClick={() => setTool('pen')}
            className={`px-3 py-1.5 text-xs flex items-center gap-1 ${
              tool === 'pen' ? 'bg-stone-800 text-stone-50' : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <PenLine size={13} /> 펜
          </button>
          <button
            onClick={() => setTool('eraser')}
            className={`px-3 py-1.5 text-xs flex items-center gap-1 border-l border-stone-200 ${
              tool === 'eraser' ? 'bg-stone-800 text-stone-50' : 'text-stone-600 hover:bg-stone-50'
            }`}
          >
            <Eraser size={13} /> 지우개
          </button>
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          {PEN_SIZES.map((s) => (
            <button
              key={s}
              onClick={() => setPenSize(s)}
              className={`w-7 h-7 rounded-full border flex items-center justify-center ${
                penSize === s ? 'border-stone-800' : 'border-stone-200'
              }`}
              aria-label={`두께 ${s}`}
            >
              <span className="block rounded-full bg-stone-800" style={{ width: s + 2, height: s + 2 }} />
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 ml-1">
          {PEN_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => {
                setTool('pen');
                setPenColor(c);
              }}
              className={`w-6 h-6 rounded-full border-2 ${penColor === c && tool === 'pen' ? 'border-stone-800' : 'border-stone-200'}`}
              style={{ backgroundColor: c }}
              aria-label={c}
            />
          ))}
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="text-xs px-2.5 py-1.5 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:text-stone-300 flex items-center gap-1"
          >
            <Undo2 size={12} /> 되돌리기
          </button>
          <button
            onClick={onClear}
            disabled={!canUndo}
            className="text-xs px-2.5 py-1.5 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:text-stone-300"
          >
            전체 지우기
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <span className="text-[10px] text-stone-400 tracking-widest mr-1">종이</span>
        {PAPERS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPaper(p.id)}
            className={`px-2.5 py-1 rounded-md text-xs border ${
              paper === p.id ? 'border-stone-800 bg-stone-800 text-stone-50' : 'border-stone-200 text-stone-600 hover:border-stone-400'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function PaperBackground({ kind, width, height }: { kind: PaperKind; width: number; height: number }) {
  const style = useMemo<CSSProperties>(() => {
    const base: CSSProperties = {
      position: 'absolute',
      inset: 0,
      width,
      height,
      pointerEvents: 'none',
    };
    if (kind === 'plain') return { ...base, background: '#ffffff' };
    if (kind === 'hanji') {
      return {
        ...base,
        background:
          'radial-gradient(circle at 20% 30%, rgba(180,150,100,0.10), transparent 60%), radial-gradient(circle at 80% 70%, rgba(180,150,100,0.08), transparent 60%), #f7f2e6',
      };
    }
    if (kind === 'lined') {
      return {
        ...base,
        backgroundColor: '#ffffff',
        backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0, transparent 39px, rgba(120,113,108,0.25) 39px, rgba(120,113,108,0.25) 40px)',
      };
    }
    if (kind === 'grid') {
      return {
        ...base,
        backgroundColor: '#ffffff',
        backgroundImage:
          'repeating-linear-gradient(to right, transparent 0, transparent 31px, rgba(120,113,108,0.20) 31px, rgba(120,113,108,0.20) 32px), repeating-linear-gradient(to bottom, transparent 0, transparent 31px, rgba(120,113,108,0.20) 31px, rgba(120,113,108,0.20) 32px)',
      };
    }
    if (kind === 'dot') {
      return {
        ...base,
        backgroundColor: '#ffffff',
        backgroundImage: 'radial-gradient(rgba(120,113,108,0.35) 1px, transparent 1.5px)',
        backgroundSize: '20px 20px',
      };
    }
    return base;
  }, [kind, width, height]);
  return <div style={style} />;
}

function paintPaper(ctx: CanvasRenderingContext2D, kind: PaperKind, w: number, h: number) {
  ctx.save();
  ctx.fillStyle = kind === 'hanji' ? '#f7f2e6' : '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(120,113,108,0.25)';
  ctx.lineWidth = 1;
  if (kind === 'lined') {
    for (let y = 40; y < h; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  } else if (kind === 'grid') {
    ctx.strokeStyle = 'rgba(120,113,108,0.20)';
    for (let x = 32; x < w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 32; y < h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
  } else if (kind === 'dot') {
    ctx.fillStyle = 'rgba(120,113,108,0.35)';
    for (let y = 20; y < h; y += 20) {
      for (let x = 20; x < w; x += 20) {
        ctx.beginPath();
        ctx.arc(x, y, 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (kind === 'hanji') {
    const grad = ctx.createRadialGradient(w * 0.2, h * 0.3, 0, w * 0.2, h * 0.3, Math.max(w, h) * 0.6);
    grad.addColorStop(0, 'rgba(180,150,100,0.10)');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}
