import { useState, useEffect, useRef } from 'react';
import { Plus, ChevronLeft, PenLine, Search, Trash2, Edit3, Check } from 'lucide-react';

const SERIF = '"Noto Serif KR", "Nanum Myeongjo", "Apple SD Gothic Neo", serif';
const SANS = '"Pretendard", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const BG = '#f6f1e7';
const STORAGE_KEY = 'munjang.archive';

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
};

type NewSentenceInput = Pick<Sentence, 'text' | 'title' | 'author' | 'page' | 'tags'>;
type View = 'archive' | 'add' | 'detail' | 'transcribe';

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
          onComplete={() =>
            updateOne(selected.id, { transcribed: true, transcribedAt: new Date().toISOString() })
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
        <p className="text-stone-800 text-2xl leading-loose" style={{ wordBreak: 'keep-all' }}>
          {sentence.text}
        </p>
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

type TranscribeViewProps = {
  sentence: Sentence;
  onBack: () => void;
  onComplete: () => void;
};

function TranscribeView({ sentence, onBack, onComplete }: TranscribeViewProps) {
  const [input, setInput] = useState('');
  const [done, setDone] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const target = sentence.text;
  const progress = Math.min(input.length / target.length, 1);
  const canComplete = input.trim().length > 0;

  const handleComplete = () => {
    onComplete();
    setDone(true);
    setTimeout(() => onBack(), 1400);
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
      <header className="max-w-2xl mx-auto w-full px-6 py-10 flex items-center justify-between" style={{ fontFamily: SANS }}>
        <button onClick={onBack} className="text-stone-500 hover:text-stone-800 flex items-center gap-1 transition-colors text-sm">
          <ChevronLeft size={18} /> 돌아가기
        </button>
        <span className="text-xs text-stone-400">{Math.round(progress * 100)}%</span>
      </header>

      <div className="max-w-2xl mx-auto w-full px-6 flex-1 flex flex-col justify-center pb-32">
        <div className="mb-12">
          <p className="text-xs text-stone-400 mb-4 tracking-widest" style={{ fontFamily: SANS }}>따라 적을 문장</p>
          <p className="text-stone-400 text-xl leading-loose select-none" style={{ wordBreak: 'keep-all' }}>
            {target}
          </p>
        </div>

        <div>
          <p className="text-xs text-stone-400 mb-4 tracking-widest" style={{ fontFamily: SANS }}>나의 필사</p>
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="천천히, 한 글자씩 따라 적어보세요"
            rows={6}
            className="w-full bg-transparent outline-none resize-none text-stone-800 text-xl leading-loose placeholder-stone-300"
            style={{ wordBreak: 'keep-all', fontFamily: SERIF }}
          />
        </div>

        {canComplete && (
          <button
            onClick={handleComplete}
            className="mt-10 self-center px-8 py-3 bg-stone-800 hover:bg-stone-900 text-stone-100 rounded-full flex items-center gap-2 transition-colors"
            style={{ fontFamily: SANS }}
          >
            <Check size={16} /> 다 적었어요
          </button>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 h-0.5 bg-stone-200">
        <div className="h-full bg-stone-500 transition-all duration-300" style={{ width: `${progress * 100}%` }} />
      </div>
    </div>
  );
}
