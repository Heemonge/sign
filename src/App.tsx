import {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
  CSSProperties,
  PointerEvent as ReactPointerEvent,
} from 'react';
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
  Image as ImageIcon,
  Smile,
  Play,
  Download,
  Upload,
  CalendarDays,
  Sparkles,
  Camera,
  Loader2,
  X,
  Sun,
  Moon,
  Timer,
  Eye,
  EyeOff,
  BookOpen,
  BarChart3,
  LayoutGrid,
  Pause,
} from 'lucide-react';

const SERIF = '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif';
const SANS = '"Pretendard", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const BG = '#f6f1e7';
const STORAGE_KEY = 'munjang.archive';
const STORAGE_VERSION = 2;
const THEME_KEY = 'munjang.theme';
const GROUP_KEY = 'munjang.grouping';

const TIMER_PRESETS = [5, 10, 15, 25];

const FONTS = [
  { id: 'serif', label: '명조', family: SERIF },
  { id: 'sans', label: '고딕', family: SANS },
  { id: 'pen', label: '펜글씨', family: '"Nanum Pen Script", cursive' },
  { id: 'gowun', label: '고운', family: '"Gowun Dodum", sans-serif' },
  { id: 'gaegu', label: '개구', family: '"Gaegu", cursive' },
  { id: 'melody', label: '멜로디', family: '"Hi Melody", cursive' },
] as const;

const CHAR_COLORS = ['#1c1917', '#78716c', '#b45309', '#b91c1c', '#1d4ed8', '#15803d'];
const PEN_COLORS = ['#1c1917', '#57534e', '#b91c1c', '#c2410c', '#a16207', '#1d4ed8', '#15803d', '#a21caf'];
const PEN_SIZES = [1.5, 3, 6, 10];
const ROTATIONS = [-15, -7, 0, 7, 15];

const STICKER_PALETTE = ['❤️', '🌸', '✨', '🌿', '☁️', '⭐', '🍃', '🌙', '🕊️', '🌷', '🎀', '📖', '☕', '🫧'];

type PaperKind = 'plain' | 'lined' | 'grid' | 'dot' | 'hanji';

const PAPERS: { id: PaperKind; label: string }[] = [
  { id: 'plain', label: '무지' },
  { id: 'lined', label: '줄' },
  { id: 'grid', label: '모눈' },
  { id: 'dot', label: '점' },
  { id: 'hanji', label: '한지' },
];

type BrushKind = 'pen' | 'fountain' | 'pencil' | 'marker' | 'brush';

const BRUSHES: { id: BrushKind; label: string }[] = [
  { id: 'pen', label: '펜' },
  { id: 'fountain', label: '만년필' },
  { id: 'pencil', label: '연필' },
  { id: 'marker', label: '형광펜' },
  { id: 'brush', label: '붓' },
];

type CharStyle = {
  fontId?: string;
  sizeScale?: number;
  color?: string;
  rotation?: number;
};

type Point = { x: number; y: number; p: number };

type Stroke = {
  tool: 'pen' | 'eraser';
  brush: BrushKind;
  color: string;
  size: number;
  points: Point[];
};

type Sticker = {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
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
  strokes?: Stroke[];
  stickers?: Sticker[];
  paper?: PaperKind;
  backgroundImage?: string;
  canvasW?: number;
  canvasH?: number;
  transcribeDuration?: number;
  favorite?: boolean;
};

type NewSentenceInput = Pick<Sentence, 'text' | 'title' | 'author' | 'page' | 'tags'>;
type View = 'archive' | 'add' | 'detail' | 'transcribe' | 'calendar' | 'replay' | 'gallery' | 'stats';
type Grouping = 'recent' | 'book';

function loadSentences(): Sentence[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Sentence[];
    if (parsed && Array.isArray(parsed.sentences)) return parsed.sentences as Sentence[];
    return [];
  } catch {
    return [];
  }
}

function saveSentences(data: Sentence[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, sentences: data }));
  } catch (e) {
    console.error('save failed', e);
    alert('저장 공간이 부족해요. 오래된 항목을 삭제하거나 백업 후 정리해주세요.');
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
}

function ymd(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todaySeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function seededIndex(seed: number, length: number) {
  let h = seed | 0;
  h = (h ^ 61) ^ (h >>> 16);
  h = h + (h << 3);
  h = h ^ (h >>> 4);
  h = Math.imul(h, 0x27d4eb2d);
  h = h ^ (h >>> 15);
  return Math.abs(h) % length;
}

function computeStreak(sentences: Sentence[]) {
  const dates = new Set<string>();
  for (const s of sentences) if (s.transcribedAt) dates.add(ymd(s.transcribedAt));
  if (dates.size === 0) return 0;
  let streak = 0;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  while (dates.has(ymdLocal(d))) {
    streak++;
    d.setDate(d.getDate() - 1);
  }
  return streak;
}

export default function App() {
  const [view, setView] = useState<View>('archive');
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [dark, setDark] = useState<boolean>(false);

  useEffect(() => {
    setSentences(loadSentences());
    const t = localStorage.getItem(THEME_KEY);
    if (t === 'dark') setDark(true);
    else if (t === null && window.matchMedia('(prefers-color-scheme: dark)').matches) setDark(true);
    setLoading(false);
  }, []);

  useEffect(() => {
    localStorage.setItem(THEME_KEY, dark ? 'dark' : 'light');
  }, [dark]);

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

  const exportJson = () => {
    const blob = new Blob([JSON.stringify({ v: STORAGE_VERSION, sentences }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `munjang-backup-${ymdLocal(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJson = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        const incoming: Sentence[] = Array.isArray(data) ? data : data.sentences;
        if (!Array.isArray(incoming)) throw new Error('invalid');
        const byId = new Map(sentences.map((s) => [s.id, s] as const));
        for (const s of incoming) byId.set(s.id, { ...byId.get(s.id), ...s } as Sentence);
        persist(Array.from(byId.values()).sort((a, b) => (b.createdAt > a.createdAt ? 1 : -1)));
        alert(`${incoming.length}개의 문장을 불러왔어요.`);
      } catch {
        alert('백업 파일을 읽을 수 없어요.');
      }
    };
    reader.readAsText(file);
  };

  if (loading) {
    return (
      <div className={dark ? 'dark' : ''}>
        <div className="min-h-screen flex items-center justify-center bg-[#f6f1e7] dark:bg-stone-950">
          <div className="text-stone-400" style={{ fontFamily: SANS }}>불러오는 중…</div>
        </div>
      </div>
    );
  }

  const onSelect = (id: string) => {
    setSelectedId(id);
    setView('detail');
  };

  return (
    <div className={dark ? 'dark' : ''}>
    <div className="min-h-screen bg-[#f6f1e7] dark:bg-stone-950 text-stone-800 dark:text-stone-100" style={{ fontFamily: SERIF }}>
      {view === 'archive' && (
        <ArchiveView
          sentences={filtered}
          allSentences={sentences}
          totalCount={sentences.length}
          onAdd={() => setView('add')}
          onSelect={onSelect}
          onCalendar={() => setView('calendar')}
          onGallery={() => setView('gallery')}
          onStats={() => setView('stats')}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onExport={exportJson}
          onImport={importJson}
          dark={dark}
          onToggleDark={() => setDark((v) => !v)}
        />
      )}
      {view === 'add' && <AddView onSave={addSentence} onCancel={() => setView('archive')} />}
      {view === 'detail' && selected && (
        <DetailView
          sentence={selected}
          onBack={() => setView('archive')}
          onTranscribe={() => setView('transcribe')}
          onReplay={() => setView('replay')}
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
      {view === 'calendar' && (
        <CalendarView sentences={sentences} onBack={() => setView('archive')} />
      )}
      {view === 'gallery' && (
        <GalleryView sentences={sentences} onBack={() => setView('archive')} onSelect={onSelect} />
      )}
      {view === 'stats' && (
        <StatsView sentences={sentences} onBack={() => setView('archive')} />
      )}
      {view === 'replay' && selected && (
        <ReplayView sentence={selected} onBack={() => setView('detail')} />
      )}
    </div>
    </div>
  );
}

type ArchiveViewProps = {
  sentences: Sentence[];
  allSentences: Sentence[];
  totalCount: number;
  onAdd: () => void;
  onSelect: (id: string) => void;
  onCalendar: () => void;
  onGallery: () => void;
  onStats: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  onExport: () => void;
  onImport: (file: File) => void;
  dark: boolean;
  onToggleDark: () => void;
};

function ArchiveView({
  sentences,
  allSentences,
  totalCount,
  onAdd,
  onSelect,
  onCalendar,
  onGallery,
  onStats,
  searchQuery,
  setSearchQuery,
  onExport,
  onImport,
  dark,
  onToggleDark,
}: ArchiveViewProps) {
  const [showSearch, setShowSearch] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [grouping, setGrouping] = useState<Grouping>(() => (localStorage.getItem(GROUP_KEY) as Grouping) || 'recent');
  const fileRef = useRef<HTMLInputElement | null>(null);
  const streak = useMemo(() => computeStreak(allSentences), [allSentences]);
  const todayPick = useMemo(() => {
    if (allSentences.length === 0) return null;
    return allSentences[seededIndex(todaySeed(), allSentences.length)];
  }, [allSentences]);

  useEffect(() => {
    localStorage.setItem(GROUP_KEY, grouping);
  }, [grouping]);

  const grouped = useMemo(() => {
    if (grouping !== 'book') return null;
    const map = new Map<string, Sentence[]>();
    for (const s of sentences) {
      const k = (s.title || '').trim() || '__none__';
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(s);
    }
    return Array.from(map.entries()).sort((a, b) => {
      if (a[0] === '__none__') return 1;
      if (b[0] === '__none__') return -1;
      return a[0].localeCompare(b[0], 'ko');
    });
  }, [grouping, sentences]);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 pb-32">
      <header className="mb-10 flex items-end justify-between">
        <div>
          <h1 className="text-4xl text-stone-800 mb-2" style={{ letterSpacing: '0.08em' }}>문장</h1>
          <p className="text-sm text-stone-500" style={{ fontFamily: SANS }}>
            {totalCount === 0 ? '오늘 한 문장을 모아볼까요' : `${totalCount}개의 문장을 모았어요`}
            {streak > 0 && <span className="ml-2 text-stone-400">· {streak}일째</span>}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onGallery}
            className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors p-2"
            aria-label="갤러리"
          >
            <LayoutGrid size={19} />
          </button>
          <button
            onClick={onCalendar}
            className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors p-2"
            aria-label="달력"
          >
            <CalendarDays size={20} />
          </button>
          <button
            onClick={onStats}
            className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors p-2"
            aria-label="통계"
          >
            <BarChart3 size={19} />
          </button>
          <button
            onClick={() => {
              setShowSearch(!showSearch);
              if (showSearch) setSearchQuery('');
            }}
            className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors p-2"
            aria-label="검색"
          >
            <Search size={20} />
          </button>
          <button
            onClick={onToggleDark}
            className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors p-2"
            aria-label={dark ? '밝게' : '어둡게'}
          >
            {dark ? <Sun size={19} /> : <Moon size={19} />}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 transition-colors p-2"
              aria-label="더보기"
            >
              <span className="text-xl leading-none">⋯</span>
            </button>
            {showMenu && (
              <div
                className="absolute right-0 top-full mt-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-lg shadow-md py-1 z-10 min-w-[10rem]"
                style={{ fontFamily: SANS }}
                onMouseLeave={() => setShowMenu(false)}
              >
                <button
                  onClick={() => {
                    onExport();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2"
                >
                  <Download size={14} /> 백업 내보내기
                </button>
                <button
                  onClick={() => {
                    fileRef.current?.click();
                    setShowMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-stone-700 dark:text-stone-200 hover:bg-stone-50 dark:hover:bg-stone-700 flex items-center gap-2"
                >
                  <Upload size={14} /> 백업 불러오기
                </button>
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onImport(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
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

      {todayPick && !searchQuery && (
        <button
          onClick={() => onSelect(todayPick.id)}
          className="w-full text-left mb-10 px-7 py-8 bg-gradient-to-br from-stone-100 to-amber-50 border border-amber-100/50 rounded-lg hover:shadow-sm transition-all"
        >
          <p className="flex items-center gap-1.5 text-xs text-amber-700/80 tracking-widest mb-4" style={{ fontFamily: SANS }}>
            <Sparkles size={12} /> 오늘의 한 문장
          </p>
          <p className="text-stone-800 text-lg leading-loose" style={{ wordBreak: 'keep-all' }}>
            {todayPick.text.length > 160 ? todayPick.text.slice(0, 160) + '…' : todayPick.text}
          </p>
          {(todayPick.title || todayPick.author) && (
            <p className="mt-4 text-xs text-stone-500" style={{ fontFamily: SANS }}>
              {todayPick.title && <span className="italic">『{todayPick.title}』</span>}
              {todayPick.author && <span> · {todayPick.author}</span>}
            </p>
          )}
        </button>
      )}

      {sentences.length > 0 && (
        <div className="mb-6 flex items-center gap-1 text-xs" style={{ fontFamily: SANS }}>
          <button
            onClick={() => setGrouping('recent')}
            className={`px-2.5 py-1 rounded-md ${
              grouping === 'recent'
                ? 'bg-stone-800 dark:bg-stone-200 text-stone-50 dark:text-stone-900'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100'
            }`}
          >
            최신순
          </button>
          <button
            onClick={() => setGrouping('book')}
            className={`px-2.5 py-1 rounded-md flex items-center gap-1 ${
              grouping === 'book'
                ? 'bg-stone-800 dark:bg-stone-200 text-stone-50 dark:text-stone-900'
                : 'text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100'
            }`}
          >
            <BookOpen size={11} /> 책별
          </button>
        </div>
      )}

      {sentences.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-stone-500 dark:text-stone-400 mb-3 text-lg" style={{ wordBreak: 'keep-all' }}>
            아직 모은 문장이 없어요
          </p>
          <p className="text-stone-400 dark:text-stone-500 text-sm" style={{ fontFamily: SANS }}>
            마음에 닿은 한 문장부터, 천천히
          </p>
        </div>
      ) : grouped ? (
        <div className="space-y-10">
          {grouped.map(([key, items]) => (
            <div key={key}>
              <div className="flex items-end justify-between mb-4">
                <h3 className="text-stone-700 dark:text-stone-200 text-base" style={{ fontFamily: SERIF }}>
                  {key === '__none__' ? <span className="italic text-stone-400 dark:text-stone-500">출처 없음</span> : <span className="italic">『{key}』</span>}
                </h3>
                <span className="text-xs text-stone-400 dark:text-stone-500" style={{ fontFamily: SANS }}>
                  {items.length}개
                </span>
              </div>
              <div className="space-y-4">
                {items.map((s) => (
                  <SentenceCard key={s.id} sentence={s} onSelect={onSelect} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          {sentences.map((s) => (
            <SentenceCard key={s.id} sentence={s} onSelect={onSelect} />
          ))}
        </div>
      )}

      <button
        onClick={onAdd}
        className="fixed bottom-8 right-8 w-14 h-14 bg-stone-800 hover:bg-stone-900 dark:bg-stone-200 dark:hover:bg-stone-50 text-stone-100 dark:text-stone-900 rounded-full shadow-lg flex items-center justify-center transition-colors"
        aria-label="문장 추가"
      >
        <Plus size={22} />
      </button>
    </div>
  );
}

function SentenceCard({ sentence: s, onSelect }: { sentence: Sentence; onSelect: (id: string) => void }) {
  return (
    <button
      onClick={() => onSelect(s.id)}
      className="w-full text-left bg-white/70 dark:bg-stone-900/60 hover:bg-white dark:hover:bg-stone-900 border border-stone-200/70 dark:border-stone-700 rounded-lg p-7 transition-all hover:shadow-sm"
    >
      <p className="text-stone-800 dark:text-stone-100 text-lg leading-loose mb-5" style={{ wordBreak: 'keep-all' }}>
        {s.text.length > 140 ? s.text.slice(0, 140) + '…' : s.text}
      </p>
      <div className="flex items-center justify-between text-xs text-stone-500 dark:text-stone-400" style={{ fontFamily: SANS }}>
        <span>
          {s.title && <span className="italic">『{s.title}』</span>}
          {s.author && <span> · {s.author}</span>}
          {!s.title && !s.author && <span className="text-stone-400 dark:text-stone-500">출처 없음</span>}
        </span>
        {s.transcribed && (
          <span className="flex items-center gap-1 text-stone-400 dark:text-stone-500">
            <PenLine size={11} /> 필사함
          </span>
        )}
      </div>
    </button>
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
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const photoRef = useRef<HTMLInputElement | null>(null);

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

  const runOcr = async (file: File) => {
    setOcrLoading(true);
    setOcrProgress(0);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker(['kor', 'eng'], 1, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === 'recognizing text') setOcrProgress(m.progress);
        },
      });
      const { data } = await worker.recognize(file);
      await worker.terminate();
      const cleaned = data.text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
      setText((prev) => (prev ? prev + '\n' + cleaned : cleaned));
    } catch (e) {
      console.error(e);
      alert('글자 인식에 실패했어요. 사진을 다시 시도해주세요.');
    } finally {
      setOcrLoading(false);
    }
  };

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
          <div className="flex items-center justify-between mb-3">
            <label className="block text-xs text-stone-500 tracking-wide" style={{ fontFamily: SANS }}>문장</label>
            <button
              onClick={() => photoRef.current?.click()}
              disabled={ocrLoading}
              className="text-xs text-stone-500 hover:text-stone-800 flex items-center gap-1 disabled:text-stone-300"
              style={{ fontFamily: SANS }}
            >
              {ocrLoading ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              {ocrLoading ? `읽는 중 ${Math.round(ocrProgress * 100)}%` : '책 사진에서 가져오기'}
            </button>
            <input
              ref={photoRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) runOcr(f);
                e.target.value = '';
              }}
            />
          </div>
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
  onReplay: () => void;
  onUpdate: (updates: Partial<Sentence>) => void;
  onDelete: () => void;
};

function DetailView({ sentence, onBack, onTranscribe, onReplay, onUpdate, onDelete }: DetailViewProps) {
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

  const hasTranscription = (sentence.strokes && sentence.strokes.length > 0) || !!sentence.drawing;

  const downloadFramed = async () => {
    try {
      const blob = await renderFramed(sentence);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `munjang-${sentence.id}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert('이미지 생성에 실패했어요.');
    }
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

      {hasTranscription && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm text-stone-500 tracking-wide" style={{ fontFamily: SANS }}>필사한 글씨</h3>
            <div className="flex items-center gap-1 text-xs" style={{ fontFamily: SANS }}>
              {sentence.strokes && sentence.strokes.length > 0 && (
                <button
                  onClick={onReplay}
                  className="text-stone-500 hover:text-stone-800 flex items-center gap-1 px-2 py-1"
                >
                  <Play size={12} /> 재생
                </button>
              )}
              <button
                onClick={downloadFramed}
                className="text-stone-500 hover:text-stone-800 flex items-center gap-1 px-2 py-1"
              >
                <Download size={12} /> 저장
              </button>
            </div>
          </div>
          <div className="rounded-lg overflow-hidden border border-stone-200 bg-white">
            <TranscriptionPreview sentence={sentence} />
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

function TranscriptionPreview({ sentence }: { sentence: Sentence }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [w, setW] = useState(0);

  useEffect(() => {
    const update = () => {
      if (wrapRef.current) setW(wrapRef.current.clientWidth);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (!sentence.strokes || w === 0) return;
    const srcW = sentence.canvasW ?? 800;
    const srcH = sentence.canvasH ?? 480;
    const ratio = window.devicePixelRatio || 1;
    const targetH = Math.round((w * srcH) / srcW);
    const canvas = canvasRef.current!;
    canvas.width = w * ratio;
    canvas.height = targetH * ratio;
    canvas.style.width = `${w}px`;
    canvas.style.height = `${targetH}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    const scale = w / srcW;
    ctx.save();
    paintPaperCtx(ctx, sentence.paper ?? 'plain', w, targetH);
    if (sentence.backgroundImage) {
      const img = new Image();
      img.onload = () => {
        ctx.save();
        ctx.globalAlpha = 0.85;
        drawCover(ctx, img, 0, 0, w, targetH);
        ctx.restore();
        drawStrokesScaled(ctx, sentence.strokes!, scale);
        drawStickersScaled(ctx, sentence.stickers ?? [], scale);
      };
      img.src = sentence.backgroundImage;
    } else {
      drawStrokesScaled(ctx, sentence.strokes!, scale);
      drawStickersScaled(ctx, sentence.stickers ?? [], scale);
    }
    ctx.restore();
  }, [sentence, w]);

  if (!sentence.strokes || sentence.strokes.length === 0) {
    return sentence.drawing ? <img src={sentence.drawing} alt="필사" className="w-full block" /> : null;
  }

  return (
    <div ref={wrapRef} className="w-full">
      <canvas ref={canvasRef} className="block" />
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
        const rotation = st?.rotation ?? 0;
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
              display: 'inline-block',
              transform: rotation ? `rotate(${rotation}deg)` : undefined,
              transformOrigin: 'center',
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
  onComplete: (payload: {
    drawing?: string;
    strokes?: Stroke[];
    stickers?: Sticker[];
    charStyles?: Record<number, CharStyle>;
    paper?: PaperKind;
    backgroundImage?: string;
    canvasW?: number;
    canvasH?: number;
    transcribeDuration?: number;
  }) => void;
};

function TranscribeView({ sentence, onBack, onComplete }: TranscribeViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const [strokes, setStrokes] = useState<Stroke[]>(sentence.strokes ?? []);
  const currentStrokeRef = useRef<Stroke | null>(null);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [brush, setBrush] = useState<BrushKind>('pen');
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0]);
  const [penSize, setPenSize] = useState<number>(PEN_SIZES[1]);
  const [paper, setPaper] = useState<PaperKind>(sentence.paper ?? 'plain');
  const [backgroundImage, setBackgroundImage] = useState<string | undefined>(sentence.backgroundImage);
  const [penOnly, setPenOnly] = useState<boolean>(true);
  const [charStyles, setCharStyles] = useState<Record<number, CharStyle>>(sentence.charStyles ?? {});
  const [editingChar, setEditingChar] = useState<number | null>(null);
  const [stickers, setStickers] = useState<Sticker[]>(sentence.stickers ?? []);
  const [stickerMode, setStickerMode] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [canvasSize, setCanvasSize] = useState<{ w: number; h: number }>({ w: 800, h: 480 });
  const bgFileRef = useRef<HTMLInputElement | null>(null);
  const [tracing, setTracing] = useState(false);
  const [timerMin, setTimerMin] = useState<number>(0);
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [now, setNow] = useState<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());

  const timerSecondsLeft = timerStart && timerMin > 0 ? Math.max(0, timerMin * 60 - Math.floor((now - timerStart) / 1000)) : null;

  useEffect(() => {
    if (!timerStart) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [timerStart]);

  useEffect(() => {
    if (timerSecondsLeft === 0 && timerStart) {
      playChime();
      setTimerStart(null);
    }
  }, [timerSecondsLeft, timerStart]);

  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const w = Math.max(280, Math.floor(rect.width));
      const h = Math.max(320, Math.floor(Math.min(window.innerHeight * 0.6, w * 0.75)));
      setCanvasSize({ w, h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.onload = () => {
        bgImgRef.current = img;
        drawAll();
      };
      img.src = backgroundImage;
    } else {
      bgImgRef.current = null;
    }
  }, [backgroundImage]);

  const drawAll = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const ratio = window.devicePixelRatio || 1;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
    if (bgImgRef.current) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      drawCover(ctx, bgImgRef.current, 0, 0, canvasSize.w, canvasSize.h);
      ctx.restore();
    }
    const all = currentStrokeRef.current ? [...strokes, currentStrokeRef.current] : strokes;
    drawStrokes(ctx, all);
    drawStickers(ctx, stickers);
  }, [strokes, stickers, canvasSize.w, canvasSize.h]);

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

  const tryRemoveStickerAt = (x: number, y: number) => {
    for (let i = stickers.length - 1; i >= 0; i--) {
      const st = stickers[i];
      if (Math.hypot(x - st.x, y - st.y) <= st.size * 0.6) {
        setStickers((prev) => prev.filter((_, j) => j !== i));
        return true;
      }
    }
    return false;
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (stickerMode) {
      const p = getPos(e);
      if (tryRemoveStickerAt(p.x, p.y)) return;
      setStickers((prev) => [
        ...prev,
        { id: `${Date.now()}-${Math.random().toString(16).slice(2, 6)}`, emoji: stickerMode, x: p.x, y: p.y, size: 36 },
      ]);
      return;
    }
    if (!shouldDraw(e)) return;
    e.preventDefault();
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    const p = getPos(e);
    currentStrokeRef.current = {
      tool,
      brush,
      color: tool === 'pen' ? penColor : '#000000',
      size: tool === 'pen' ? penSize : penSize * 3,
      points: [p],
    };
    drawAll();
  };

  const onPointerMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (stickerMode) return;
    if (!currentStrokeRef.current) return;
    if (!shouldDraw(e)) return;
    const p = getPos(e);
    currentStrokeRef.current.points.push(p);
    drawAll();
  };

  const onPointerUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (stickerMode) return;
    if (!currentStrokeRef.current) return;
    const finished = currentStrokeRef.current;
    currentStrokeRef.current = null;
    setStrokes((prev) => [...prev, finished]);
    try {
      (e.target as HTMLCanvasElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const undo = () => {
    if (stickers.length > strokes.length && stickers.length > 0) {
      setStickers((prev) => prev.slice(0, -1));
    } else if (strokes.length > 0) {
      setStrokes((prev) => prev.slice(0, -1));
    }
  };
  const clearAll = () => {
    if (!confirm('정말로 다 지울까요?')) return;
    setStrokes([]);
    setStickers([]);
  };

  const handleBgUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => setBackgroundImage(String(reader.result));
    reader.readAsDataURL(file);
  };

  const handleComplete = () => {
    const elapsed = Math.round((Date.now() - sessionStartRef.current) / 1000);
    onComplete({
      strokes,
      stickers,
      charStyles,
      paper,
      backgroundImage,
      canvasW: canvasSize.w,
      canvasH: canvasSize.h,
      drawing: undefined,
      transcribeDuration: (sentence.transcribeDuration ?? 0) + elapsed,
    });
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
      <header className="max-w-3xl mx-auto w-full px-6 py-8 flex items-center justify-between flex-wrap gap-3" style={{ fontFamily: SANS }}>
        <button onClick={onBack} className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 flex items-center gap-1 transition-colors text-sm">
          <ChevronLeft size={18} /> 돌아가기
        </button>
        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 flex-wrap">
          <button
            onClick={() => setTracing((v) => !v)}
            className={`px-2.5 py-1.5 rounded-md border flex items-center gap-1 ${
              tracing
                ? 'border-stone-800 bg-stone-800 text-stone-50 dark:bg-stone-200 dark:border-stone-200 dark:text-stone-900'
                : 'border-stone-200 dark:border-stone-700 hover:border-stone-400'
            }`}
          >
            {tracing ? <Eye size={12} /> : <EyeOff size={12} />}
            가이드
          </button>
          <TimerControl
            timerMin={timerMin}
            setTimerMin={setTimerMin}
            secondsLeft={timerSecondsLeft}
            running={!!timerStart}
            onStart={() => {
              if (timerMin > 0) setTimerStart(Date.now());
            }}
            onStop={() => setTimerStart(null)}
          />
          <label className="flex items-center gap-1.5 cursor-pointer select-none">
            <input type="checkbox" checked={penOnly} onChange={(e) => setPenOnly(e.target.checked)} className="accent-stone-700" />
            펜으로만
          </label>
          <button
            onClick={handleComplete}
            className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 dark:bg-stone-200 dark:hover:bg-stone-50 text-stone-100 dark:text-stone-900 rounded-full text-sm flex items-center gap-1.5"
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
          <div ref={containerRef} className="relative rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700" style={{ background: '#fff' }}>
            <PaperBackground kind={paper} width={canvasSize.w} height={canvasSize.h} />
            {tracing && (
              <TracingOverlay
                text={sentence.text}
                charStyles={charStyles}
                width={canvasSize.w}
                height={canvasSize.h}
              />
            )}
            <canvas
              ref={canvasRef}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              className="block relative"
              style={{
                touchAction: 'none',
                cursor: stickerMode ? 'copy' : tool === 'eraser' ? 'cell' : 'crosshair',
              }}
            />
            {stickerMode && (
              <div
                className="absolute top-3 left-3 right-3 bg-white/95 border border-stone-200 rounded-md px-3 py-1.5 text-xs text-stone-600 flex items-center justify-between"
                style={{ fontFamily: SANS }}
              >
                <span>
                  <span className="mr-1.5 text-base">{stickerMode}</span> 캔버스를 눌러 붙여보세요. 스티커를 눌러 지울 수도 있어요.
                </span>
                <button onClick={() => setStickerMode(null)} className="text-stone-500 hover:text-stone-800 ml-2">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>

          <Toolbar
            tool={tool}
            setTool={setTool}
            brush={brush}
            setBrush={setBrush}
            penColor={penColor}
            setPenColor={setPenColor}
            penSize={penSize}
            setPenSize={setPenSize}
            paper={paper}
            setPaper={setPaper}
            onUndo={undo}
            onClear={clearAll}
            canUndo={strokes.length > 0 || stickers.length > 0}
            onBgUpload={() => bgFileRef.current?.click()}
            onBgClear={() => setBackgroundImage(undefined)}
            hasBg={!!backgroundImage}
            stickerMode={stickerMode}
            setStickerMode={setStickerMode}
          />
          <input
            ref={bgFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleBgUpload(f);
              e.target.value = '';
            }}
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
          <p className="text-[10px] text-stone-400 tracking-widest mb-1.5">기울기</p>
          <div className="flex gap-1.5">
            {ROTATIONS.map((r) => {
              const active = (style.rotation ?? 0) === r;
              return (
                <button
                  key={r}
                  onClick={() => onChange({ rotation: r })}
                  className={`px-2.5 py-1 rounded-md text-xs border ${
                    active ? 'border-stone-800 bg-stone-800 text-stone-50' : 'border-stone-200 text-stone-600 hover:border-stone-400'
                  }`}
                >
                  {r === 0 ? '바로' : `${r}°`}
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
  brush,
  setBrush,
  penColor,
  setPenColor,
  penSize,
  setPenSize,
  paper,
  setPaper,
  onUndo,
  onClear,
  canUndo,
  onBgUpload,
  onBgClear,
  hasBg,
  stickerMode,
  setStickerMode,
}: {
  tool: 'pen' | 'eraser';
  setTool: (t: 'pen' | 'eraser') => void;
  brush: BrushKind;
  setBrush: (b: BrushKind) => void;
  penColor: string;
  setPenColor: (c: string) => void;
  penSize: number;
  setPenSize: (s: number) => void;
  paper: PaperKind;
  setPaper: (p: PaperKind) => void;
  onUndo: () => void;
  onClear: () => void;
  canUndo: boolean;
  onBgUpload: () => void;
  onBgClear: () => void;
  hasBg: boolean;
  stickerMode: string | null;
  setStickerMode: (s: string | null) => void;
}) {
  const [showStickers, setShowStickers] = useState(false);
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

        <div className="flex border border-stone-200 rounded-md overflow-hidden">
          {BRUSHES.map((b) => (
            <button
              key={b.id}
              onClick={() => {
                setBrush(b.id);
                setTool('pen');
              }}
              className={`px-2.5 py-1.5 text-xs border-l first:border-l-0 border-stone-200 ${
                brush === b.id && tool === 'pen' ? 'bg-stone-800 text-stone-50' : 'text-stone-600 hover:bg-stone-50'
              }`}
            >
              {b.label}
            </button>
          ))}
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

        <div className="flex items-center gap-1.5 ml-1 flex-wrap">
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

        <div className="mx-2 h-4 w-px bg-stone-200" />

        <button
          onClick={onBgUpload}
          className="text-xs px-2.5 py-1 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50 flex items-center gap-1"
        >
          <ImageIcon size={12} /> {hasBg ? '배경 바꾸기' : '배경 사진'}
        </button>
        {hasBg && (
          <button
            onClick={onBgClear}
            className="text-xs px-2.5 py-1 rounded-md border border-stone-200 text-stone-600 hover:bg-stone-50"
          >
            배경 지우기
          </button>
        )}

        <div className="mx-2 h-4 w-px bg-stone-200" />

        <div className="relative">
          <button
            onClick={() => setShowStickers((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1 ${
              stickerMode ? 'border-stone-800 bg-stone-800 text-stone-50' : 'border-stone-200 text-stone-600 hover:bg-stone-50'
            }`}
          >
            <Smile size={12} /> 스티커
            {stickerMode && <span className="ml-1">{stickerMode}</span>}
          </button>
          {showStickers && (
            <div className="absolute bottom-full mb-1 left-0 bg-white border border-stone-200 rounded-md shadow-md p-2 grid grid-cols-7 gap-1 z-10 min-w-[14rem]">
              {STICKER_PALETTE.map((e) => (
                <button
                  key={e}
                  onClick={() => {
                    setStickerMode(e);
                    setShowStickers(false);
                  }}
                  className="w-7 h-7 rounded hover:bg-stone-100 text-lg flex items-center justify-center"
                >
                  {e}
                </button>
              ))}
              {stickerMode && (
                <button
                  onClick={() => {
                    setStickerMode(null);
                    setShowStickers(false);
                  }}
                  className="col-span-7 text-xs text-stone-500 hover:text-stone-800 py-1"
                >
                  스티커 끄기
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PaperBackground({ kind, width, height }: { kind: PaperKind; width: number; height: number }) {
  const style = useMemo<CSSProperties>(() => paperStyle(kind, width, height), [kind, width, height]);
  return <div style={style} />;
}

function paperStyle(kind: PaperKind, width: number, height: number): CSSProperties {
  const base: CSSProperties = { position: 'absolute', inset: 0, width, height, pointerEvents: 'none' };
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
      backgroundImage:
        'repeating-linear-gradient(to bottom, transparent 0, transparent 39px, rgba(120,113,108,0.25) 39px, rgba(120,113,108,0.25) 40px)',
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
}

function paintPaperCtx(ctx: CanvasRenderingContext2D, kind: PaperKind, w: number, h: number) {
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

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const sR = img.width / img.height;
  const dR = w / h;
  let sw = img.width;
  let sh = img.height;
  let sx = 0;
  let sy = 0;
  if (sR > dR) {
    sw = img.height * dR;
    sx = (img.width - sw) / 2;
  } else {
    sh = img.width / dR;
    sy = (img.height - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: Stroke[]) {
  drawStrokesScaled(ctx, strokes, 1);
}

function drawStrokesScaled(ctx: CanvasRenderingContext2D, strokes: Stroke[], scale: number) {
  for (const s of strokes) {
    if (s.points.length === 0) continue;
    drawStrokePartial(ctx, s, s.points.length, scale);
  }
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
}

function drawStrokePartial(ctx: CanvasRenderingContext2D, s: Stroke, upto: number, scale: number) {
  if (s.points.length === 0 || upto <= 0) return;
  const pts = s.points.slice(0, upto);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const brush = s.brush ?? 'pen';
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';

  if (brush === 'marker') {
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = s.color;
    ctx.lineCap = 'butt';
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      ctx.lineWidth = s.size * 1.8 * scale;
      ctx.beginPath();
      ctx.moveTo(a.x * scale, a.y * scale);
      ctx.lineTo(b.x * scale, b.y * scale);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (brush === 'pencil') {
    ctx.globalAlpha = 0.65;
    ctx.strokeStyle = s.color;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      ctx.lineWidth = s.size * (0.7 + ((a.p + b.p) / 2) * 0.3) * scale;
      ctx.beginPath();
      ctx.moveTo(a.x * scale, a.y * scale);
      ctx.lineTo(b.x * scale, b.y * scale);
      ctx.stroke();
      const speed = Math.hypot(b.x - a.x, b.y - a.y);
      const grains = Math.min(3, Math.floor(speed / 4));
      ctx.fillStyle = s.color;
      ctx.globalAlpha = 0.25;
      for (let g = 0; g < grains; g++) {
        const t = Math.random();
        const px = (a.x + (b.x - a.x) * t + (Math.random() - 0.5) * s.size) * scale;
        const py = (a.y + (b.y - a.y) * t + (Math.random() - 0.5) * s.size) * scale;
        ctx.fillRect(px, py, 0.8 * scale, 0.8 * scale);
      }
      ctx.globalAlpha = 0.65;
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (brush === 'brush') {
    ctx.strokeStyle = s.color;
    ctx.globalAlpha = 0.9;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const w = s.size * (0.4 + ((a.p + b.p) / 2) * 1.4) * scale;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x * scale, a.y * scale);
      ctx.lineTo(b.x * scale, b.y * scale);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    return;
  }

  if (brush === 'fountain') {
    ctx.strokeStyle = s.color;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const speed = Math.hypot(b.x - a.x, b.y - a.y);
      const w = Math.max(s.size * 0.6, s.size * (1.2 - speed * 0.04)) * scale;
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(a.x * scale, a.y * scale);
      ctx.lineTo(b.x * scale, b.y * scale);
      ctx.stroke();
    }
    return;
  }

  ctx.strokeStyle = s.color;
  if (pts.length === 1) {
    const p = pts[0];
    ctx.beginPath();
    ctx.arc(p.x * scale, p.y * scale, ((s.size * (0.6 + p.p * 0.6)) / 2) * scale, 0, Math.PI * 2);
    ctx.fillStyle = s.color;
    ctx.fill();
    return;
  }
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const w = s.size * (0.6 + ((a.p + b.p) / 2) * 0.6) * scale;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(a.x * scale, a.y * scale);
    ctx.lineTo(b.x * scale, b.y * scale);
    ctx.stroke();
  }
}

function drawStickers(ctx: CanvasRenderingContext2D, stickers: Sticker[]) {
  drawStickersScaled(ctx, stickers, 1);
}

function drawStickersScaled(ctx: CanvasRenderingContext2D, stickers: Sticker[], scale: number) {
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const s of stickers) {
    ctx.font = `${s.size * scale}px serif`;
    ctx.fillText(s.emoji, s.x * scale, s.y * scale);
  }
  ctx.restore();
}

type CalendarViewProps = {
  sentences: Sentence[];
  onBack: () => void;
};

function CalendarView({ sentences, onBack }: CalendarViewProps) {
  const [month, setMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const dates = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of sentences) {
      if (!s.transcribedAt) continue;
      const k = ymd(s.transcribedAt);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [sentences]);

  const streak = useMemo(() => computeStreak(sentences), [sentences]);
  const totalDays = dates.size;

  const year = month.getFullYear();
  const m = month.getMonth();
  const firstDay = new Date(year, m, 1).getDay();
  const daysInMonth = new Date(year, m + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let i = 1; i <= daysInMonth; i++) cells.push(new Date(year, m, i));

  const today = ymdLocal(new Date());

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 pb-32">
      <header className="flex items-center justify-between mb-10" style={{ fontFamily: SANS }}>
        <button onClick={onBack} className="text-stone-500 hover:text-stone-800 flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> 목록
        </button>
        <h2 className="text-stone-600 text-sm">필사 달력</h2>
        <div className="w-12" />
      </header>

      <div className="grid grid-cols-2 gap-6 mb-10" style={{ fontFamily: SANS }}>
        <div className="bg-white/70 border border-stone-200 rounded-lg p-5 text-center">
          <p className="text-xs text-stone-400 tracking-widest mb-2">연속 기록</p>
          <p className="text-3xl text-stone-800">{streak}<span className="text-base text-stone-500 ml-1">일</span></p>
        </div>
        <div className="bg-white/70 border border-stone-200 rounded-lg p-5 text-center">
          <p className="text-xs text-stone-400 tracking-widest mb-2">필사한 날</p>
          <p className="text-3xl text-stone-800">{totalDays}<span className="text-base text-stone-500 ml-1">일</span></p>
        </div>
      </div>

      <div className="bg-white/70 border border-stone-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-5" style={{ fontFamily: SANS }}>
          <button
            onClick={() => setMonth(new Date(year, m - 1, 1))}
            className="text-stone-500 hover:text-stone-800 p-1"
          >
            ‹
          </button>
          <p className="text-stone-700 text-sm">
            {year}년 {m + 1}월
          </p>
          <button
            onClick={() => setMonth(new Date(year, m + 1, 1))}
            className="text-stone-500 hover:text-stone-800 p-1"
          >
            ›
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-stone-400 tracking-widest mb-2" style={{ fontFamily: SANS }}>
          {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const k = ymdLocal(d);
            const count = dates.get(k) ?? 0;
            const isToday = k === today;
            return (
              <div
                key={i}
                className={`aspect-square rounded-md flex items-center justify-center text-sm relative ${
                  count > 0
                    ? 'bg-stone-800 text-stone-50'
                    : isToday
                    ? 'border border-stone-400 text-stone-700'
                    : 'text-stone-500'
                }`}
              >
                {d.getDate()}
                {count > 1 && (
                  <span
                    className="absolute -top-1 -right-1 text-[10px] bg-amber-400 text-stone-900 rounded-full px-1.5"
                    style={{ fontFamily: SANS }}
                  >
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

type ReplayViewProps = {
  sentence: Sentence;
  onBack: () => void;
};

function ReplayView({ sentence, onBack }: ReplayViewProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const bgImgRef = useRef<HTMLImageElement | null>(null);
  const [size, setSize] = useState({ w: 800, h: 480 });
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const update = () => {
      const el = containerRef.current;
      if (!el) return;
      const w = Math.max(280, Math.floor(el.clientWidth));
      const srcW = sentence.canvasW ?? 800;
      const srcH = sentence.canvasH ?? 480;
      const h = Math.round((w * srcH) / srcW);
      setSize({ w, h });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [sentence]);

  useEffect(() => {
    if (sentence.backgroundImage) {
      const img = new Image();
      img.onload = () => {
        bgImgRef.current = img;
      };
      img.src = sentence.backgroundImage;
    }
  }, [sentence.backgroundImage]);

  const totalPoints = useMemo(
    () => (sentence.strokes ?? []).reduce((acc, s) => acc + s.points.length, 0),
    [sentence.strokes],
  );

  useEffect(() => {
    if (!playing) return;
    const start = performance.now();
    const duration = Math.min(12000, Math.max(2500, totalPoints * 8));
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setProgress(p);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setPlaying(false);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, totalPoints]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = size.w * ratio;
    canvas.height = size.h * ratio;
    canvas.style.width = `${size.w}px`;
    canvas.style.height = `${size.h}px`;
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    paintPaperCtx(ctx, sentence.paper ?? 'plain', size.w, size.h);
    if (bgImgRef.current) {
      ctx.save();
      ctx.globalAlpha = 0.85;
      drawCover(ctx, bgImgRef.current, 0, 0, size.w, size.h);
      ctx.restore();
    }
    const strokes = sentence.strokes ?? [];
    const srcW = sentence.canvasW ?? 800;
    const scale = size.w / srcW;
    const shownPts = Math.floor(totalPoints * progress);
    let acc = 0;
    for (const s of strokes) {
      const remaining = shownPts - acc;
      if (remaining <= 0) break;
      const partial = Math.min(s.points.length, remaining);
      drawStrokePartial(ctx, s, partial, scale);
      acc += s.points.length;
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    if (progress >= 1) drawStickersScaled(ctx, sentence.stickers ?? [], scale);
  }, [progress, size, sentence, totalPoints]);

  const replay = () => {
    setProgress(0);
    setPlaying(true);
  };

  if (!sentence.strokes || sentence.strokes.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="max-w-3xl mx-auto w-full px-6 py-8" style={{ fontFamily: SANS }}>
          <button onClick={onBack} className="text-stone-500 hover:text-stone-800 flex items-center gap-1 text-sm">
            <ChevronLeft size={18} /> 돌아가기
          </button>
        </header>
        <div className="flex-1 flex items-center justify-center text-stone-500" style={{ fontFamily: SANS }}>
          재생할 글씨가 없어요.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header className="max-w-3xl mx-auto w-full px-6 py-8 flex items-center justify-between" style={{ fontFamily: SANS }}>
        <button onClick={onBack} className="text-stone-500 hover:text-stone-800 flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> 돌아가기
        </button>
        <button
          onClick={replay}
          className="px-4 py-1.5 bg-stone-800 hover:bg-stone-900 text-stone-100 rounded-full text-sm flex items-center gap-1.5"
        >
          <Play size={14} /> 다시 재생
        </button>
      </header>
      <div className="max-w-3xl mx-auto w-full px-6">
        <p className="text-stone-700 text-lg leading-loose mb-6" style={{ wordBreak: 'keep-all' }}>
          {sentence.text}
        </p>
        <div ref={containerRef} className="rounded-lg overflow-hidden border border-stone-200 bg-white">
          <canvas ref={canvasRef} className="block" />
        </div>
        <div className="mt-3 h-0.5 bg-stone-200 rounded-full overflow-hidden">
          <div className="h-full bg-stone-700 transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
        </div>
      </div>
    </div>
  );
}

async function renderFramed(sentence: Sentence): Promise<Blob> {
  const SIZE = 1080;
  const PAD = 64;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.fillStyle = '#292524';
  ctx.font = `400 38px ${SERIF}`;
  ctx.textAlign = 'center';
  const lines = wrapText(ctx, sentence.text, SIZE - PAD * 2);
  let y = PAD + 80;
  for (const line of lines.slice(0, 4)) {
    ctx.fillText(line, SIZE / 2, y);
    y += 60;
  }
  if (lines.length > 4) {
    ctx.fillText('…', SIZE / 2, y);
    y += 60;
  }

  const drawingArea = { x: PAD, y: y + 30, w: SIZE - PAD * 2, h: SIZE - y - 30 - PAD - 60 };
  const inner = document.createElement('canvas');
  inner.width = drawingArea.w;
  inner.height = drawingArea.h;
  const ictx = inner.getContext('2d')!;
  paintPaperCtx(ictx, sentence.paper ?? 'plain', drawingArea.w, drawingArea.h);
  if (sentence.backgroundImage) {
    const img = await loadImage(sentence.backgroundImage);
    ictx.save();
    ictx.globalAlpha = 0.85;
    drawCover(ictx, img, 0, 0, drawingArea.w, drawingArea.h);
    ictx.restore();
  }
  if (sentence.strokes && sentence.strokes.length > 0) {
    const srcW = sentence.canvasW ?? 800;
    const scale = drawingArea.w / srcW;
    drawStrokesScaled(ictx, sentence.strokes, scale);
    drawStickersScaled(ictx, sentence.stickers ?? [], scale);
  } else if (sentence.drawing) {
    const img = await loadImage(sentence.drawing);
    ictx.drawImage(img, 0, 0, drawingArea.w, drawingArea.h);
  }

  ctx.save();
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.08)';
  ctx.shadowBlur = 20;
  ctx.shadowOffsetY = 4;
  roundRect(ctx, drawingArea.x, drawingArea.y, drawingArea.w, drawingArea.h, 12);
  ctx.fill();
  ctx.restore();
  ctx.save();
  roundRect(ctx, drawingArea.x, drawingArea.y, drawingArea.w, drawingArea.h, 12);
  ctx.clip();
  ctx.drawImage(inner, drawingArea.x, drawingArea.y);
  ctx.restore();

  ctx.fillStyle = '#78716c';
  ctx.font = `400 22px ${SANS}`;
  const footer = [
    sentence.title && `『${sentence.title}』`,
    sentence.author,
    sentence.transcribedAt && formatDate(sentence.transcribedAt),
  ]
    .filter(Boolean)
    .join('  ·  ');
  ctx.fillText(footer || '문장 · 필사', SIZE / 2, SIZE - PAD);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b!), 'image/png'));
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const out: string[] = [];
  const chars = Array.from(text);
  let current = '';
  for (const ch of chars) {
    if (ch === '\n') {
      out.push(current);
      current = '';
      continue;
    }
    const next = current + ch;
    if (ctx.measureText(next).width > maxWidth) {
      out.push(current);
      current = ch;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function TracingOverlay({
  text,
  charStyles,
  width,
  height,
}: {
  text: string;
  charStyles: Record<number, CharStyle>;
  width: number;
  height: number;
}) {
  const chars = Array.from(text);
  const baseSize = Math.max(28, Math.min(64, Math.floor(height / 6)));
  return (
    <div
      className="absolute inset-0 flex items-center justify-center px-8 py-6"
      style={{ pointerEvents: 'none', width, height, opacity: 0.18 }}
    >
      <p className="leading-loose text-center" style={{ wordBreak: 'keep-all' }}>
        {chars.map((ch, i) => {
          const st = charStyles?.[i];
          const fontFamily = FONTS.find((f) => f.id === (st?.fontId ?? 'serif'))?.family ?? SERIF;
          const size = baseSize * (st?.sizeScale ?? 1);
          const rotation = st?.rotation ?? 0;
          return (
            <span
              key={i}
              style={{
                fontFamily,
                fontSize: `${size}px`,
                color: '#1c1917',
                display: 'inline-block',
                transform: rotation ? `rotate(${rotation}deg)` : undefined,
                transformOrigin: 'center',
                whiteSpace: ch === '\n' ? 'pre' : undefined,
              }}
            >
              {ch}
            </span>
          );
        })}
      </p>
    </div>
  );
}

function TimerControl({
  timerMin,
  setTimerMin,
  secondsLeft,
  running,
  onStart,
  onStop,
}: {
  timerMin: number;
  setTimerMin: (m: number) => void;
  secondsLeft: number | null;
  running: boolean;
  onStart: () => void;
  onStop: () => void;
}) {
  const [open, setOpen] = useState(false);
  const display = running && secondsLeft != null
    ? `${String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:${String(secondsLeft % 60).padStart(2, '0')}`
    : timerMin > 0
    ? `${timerMin}분`
    : '타이머';
  return (
    <div className="relative">
      <button
        onClick={() => {
          if (running) onStop();
          else if (timerMin > 0) onStart();
          else setOpen((v) => !v);
        }}
        className={`px-2.5 py-1.5 rounded-md border flex items-center gap-1 ${
          running
            ? 'border-stone-800 bg-stone-800 text-stone-50 dark:bg-stone-200 dark:border-stone-200 dark:text-stone-900'
            : 'border-stone-200 dark:border-stone-700 hover:border-stone-400'
        }`}
      >
        {running ? <Pause size={12} /> : <Timer size={12} />} {display}
      </button>
      {(timerMin > 0 || open) && !running && (
        <div className="absolute top-full right-0 mt-1 bg-white dark:bg-stone-800 border border-stone-200 dark:border-stone-700 rounded-md shadow-md p-2 z-10 flex flex-wrap gap-1 min-w-[12rem]">
          {TIMER_PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => {
                setTimerMin(m);
                setOpen(false);
              }}
              className={`px-2.5 py-1 rounded-md text-xs ${
                timerMin === m
                  ? 'bg-stone-800 dark:bg-stone-200 text-stone-50 dark:text-stone-900'
                  : 'text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-700'
              }`}
            >
              {m}분
            </button>
          ))}
          {timerMin > 0 && (
            <button
              onClick={() => {
                setTimerMin(0);
                setOpen(false);
              }}
              className="px-2.5 py-1 rounded-md text-xs text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-700"
            >
              끄기
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function playChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const now = ctx.currentTime;
    const notes = [660, 880, 1320];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.65);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {}
}

type GalleryViewProps = {
  sentences: Sentence[];
  onBack: () => void;
  onSelect: (id: string) => void;
};

function GalleryView({ sentences, onBack, onSelect }: GalleryViewProps) {
  const items = sentences.filter((s) => (s.strokes && s.strokes.length > 0) || s.drawing);
  return (
    <div className="max-w-5xl mx-auto px-6 py-12 pb-32">
      <header className="flex items-center justify-between mb-10" style={{ fontFamily: SANS }}>
        <button onClick={onBack} className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> 목록
        </button>
        <h2 className="text-stone-600 dark:text-stone-300 text-sm">필사 갤러리 · {items.length}장</h2>
        <div className="w-12" />
      </header>
      {items.length === 0 ? (
        <div className="text-center py-24 text-stone-500 dark:text-stone-400" style={{ fontFamily: SANS }}>
          아직 필사한 글씨가 없어요
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {items.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelect(s.id)}
              className="text-left bg-white dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700 rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="aspect-[4/3] bg-stone-50 dark:bg-stone-900">
                <TranscriptionPreview sentence={s} />
              </div>
              <div className="px-3 py-2.5">
                <p className="text-xs text-stone-700 dark:text-stone-200 line-clamp-2 leading-relaxed" style={{ wordBreak: 'keep-all' }}>
                  {s.text}
                </p>
                {(s.title || s.author) && (
                  <p className="text-[10px] text-stone-400 dark:text-stone-500 mt-1.5 truncate" style={{ fontFamily: SANS }}>
                    {s.title && <span className="italic">『{s.title}』</span>}
                    {s.author && <span> · {s.author}</span>}
                  </p>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type StatsViewProps = {
  sentences: Sentence[];
  onBack: () => void;
};

function StatsView({ sentences, onBack }: StatsViewProps) {
  const stats = useMemo(() => {
    const transcribed = sentences.filter((s) => s.transcribed);
    const totalChars = sentences.reduce((acc, s) => acc + Array.from(s.text).length, 0);
    const totalMinutes = Math.round(sentences.reduce((acc, s) => acc + (s.transcribeDuration ?? 0), 0) / 60);
    const dates = new Set<string>();
    for (const s of sentences) if (s.transcribedAt) dates.add(ymd(s.transcribedAt));

    const bookCount = new Map<string, number>();
    const authorCount = new Map<string, number>();
    const tagCount = new Map<string, number>();
    const hour = new Array(24).fill(0) as number[];
    for (const s of sentences) {
      if (s.title) bookCount.set(s.title, (bookCount.get(s.title) ?? 0) + 1);
      if (s.author) authorCount.set(s.author, (authorCount.get(s.author) ?? 0) + 1);
      for (const t of s.tags ?? []) tagCount.set(t, (tagCount.get(t) ?? 0) + 1);
      if (s.transcribedAt) hour[new Date(s.transcribedAt).getHours()]++;
    }
    const top = (m: Map<string, number>, n: number) =>
      Array.from(m.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, n);

    return {
      total: sentences.length,
      transcribed: transcribed.length,
      totalChars,
      totalMinutes,
      days: dates.size,
      books: top(bookCount, 5),
      authors: top(authorCount, 5),
      tags: top(tagCount, 8),
      hour,
    };
  }, [sentences]);

  const maxHour = Math.max(1, ...stats.hour);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12 pb-32">
      <header className="flex items-center justify-between mb-10" style={{ fontFamily: SANS }}>
        <button onClick={onBack} className="text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 flex items-center gap-1 text-sm">
          <ChevronLeft size={18} /> 목록
        </button>
        <h2 className="text-stone-600 dark:text-stone-300 text-sm">통계</h2>
        <div className="w-12" />
      </header>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10" style={{ fontFamily: SANS }}>
        <StatCard label="모은 문장" value={stats.total} />
        <StatCard label="필사한 문장" value={stats.transcribed} />
        <StatCard label="글자 수" value={stats.totalChars.toLocaleString()} />
        <StatCard label="필사 시간(분)" value={stats.totalMinutes} />
      </div>

      <div className="space-y-8">
        <StatBlock title="자주 필사한 책">
          {stats.books.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500" style={{ fontFamily: SANS }}>없음</p>
          ) : (
            <ul className="space-y-2">
              {stats.books.map(([t, n]) => (
                <RankRow key={t} label={`『${t}』`} count={n} max={stats.books[0][1]} />
              ))}
            </ul>
          )}
        </StatBlock>

        <StatBlock title="자주 보는 저자">
          {stats.authors.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500" style={{ fontFamily: SANS }}>없음</p>
          ) : (
            <ul className="space-y-2">
              {stats.authors.map(([t, n]) => (
                <RankRow key={t} label={t} count={n} max={stats.authors[0][1]} />
              ))}
            </ul>
          )}
        </StatBlock>

        <StatBlock title="태그">
          {stats.tags.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500" style={{ fontFamily: SANS }}>없음</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {stats.tags.map(([t, n]) => (
                <span
                  key={t}
                  className="text-xs px-2.5 py-1 bg-stone-200/60 dark:bg-stone-700/60 text-stone-700 dark:text-stone-200 rounded-full"
                >
                  #{t} <span className="text-stone-400 dark:text-stone-500 ml-0.5">{n}</span>
                </span>
              ))}
            </div>
          )}
        </StatBlock>

        <StatBlock title="필사하는 시간대">
          <div className="flex items-end gap-1 h-24">
            {stats.hour.map((c, h) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full bg-stone-700 dark:bg-stone-300 rounded-sm"
                  style={{ height: `${(c / maxHour) * 100}%`, minHeight: c > 0 ? 2 : 0 }}
                />
                {h % 3 === 0 && (
                  <span className="text-[9px] text-stone-400 dark:text-stone-500" style={{ fontFamily: SANS }}>
                    {h}
                  </span>
                )}
              </div>
            ))}
          </div>
        </StatBlock>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-white/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700 rounded-lg p-5 text-center">
      <p className="text-[10px] text-stone-400 dark:text-stone-500 tracking-widest mb-2">{label}</p>
      <p className="text-2xl text-stone-800 dark:text-stone-100">{value}</p>
    </div>
  );
}

function StatBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white/70 dark:bg-stone-900/60 border border-stone-200 dark:border-stone-700 rounded-lg p-6">
      <h3 className="text-sm text-stone-600 dark:text-stone-300 tracking-wide mb-4" style={{ fontFamily: SANS }}>
        {title}
      </h3>
      {children}
    </div>
  );
}

function RankRow({ label, count, max }: { label: string; count: number; max: number }) {
  return (
    <li className="flex items-center gap-3" style={{ fontFamily: SANS }}>
      <span className="text-sm text-stone-700 dark:text-stone-200 truncate flex-shrink-0 max-w-[55%]">{label}</span>
      <div className="flex-1 h-2 bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
        <div className="h-full bg-stone-700 dark:bg-stone-300" style={{ width: `${(count / max) * 100}%` }} />
      </div>
      <span className="text-xs text-stone-500 dark:text-stone-400 w-6 text-right">{count}</span>
    </li>
  );
}
