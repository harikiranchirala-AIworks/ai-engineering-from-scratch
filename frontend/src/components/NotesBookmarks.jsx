import React, { useState, useMemo } from 'react';

export default function NotesBookmarks({ modules = [] }) {
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem('genai_user_notes') || '{}'); } catch(e) { return {}; }
  });
  const [bookmarks, setBookmarks] = useState(() => {
    try { return JSON.parse(localStorage.getItem('genai_topic_bookmarks') || '{}'); } catch(e) { return {}; }
  });
  const [activeTab, setActiveTab] = useState('notes');
  const [searchTerm, setSearchTerm] = useState('');

  const allTopicsIndexed = useMemo(() => {
    const list = [];
    modules.forEach(m => {
      if (m.sections) {
        m.sections.forEach((sec, sIdx) => {
          if (sec.topics) {
            sec.topics.forEach((it, iIdx) => {
              const key = it.key || `${m.id}-${sIdx}-${iIdx}`;
              list.push({
                key,
                moduleId: m.id,
                moduleTitle: m.title,
                sectionTitle: sec.heading,
                term: it.term,
                definition: it.definition,
                note: notes[key] || '',
                isBookmarked: !!bookmarks[key]
              });
            });
          }
        });
      }
    });
    return list;
  }, [modules, notes, bookmarks]);

  const filteredTopics = useMemo(() => {
    let items = allTopicsIndexed;
    if (activeTab === 'notes') {
      items = items.filter(t => t.note && t.note.trim().length > 0);
    } else {
      items = items.filter(t => t.isBookmarked);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(t => t.term.toLowerCase().includes(q) || t.note.toLowerCase().includes(q) || (t.moduleTitle && t.moduleTitle.toLowerCase().includes(q)));
    }
    return items;
  }, [allTopicsIndexed, activeTab, searchTerm]);

  const handleDeleteNote = (key) => {
    const updated = { ...notes };
    delete updated[key];
    setNotes(updated);
    try { localStorage.setItem('genai_user_notes', JSON.stringify(updated)); } catch(e) {}
  };

  const exportNotesJson = () => {
    const dataStr = JSON.stringify({ notes, bookmarks }, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `genai-personal-notes-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" id="notes-bookmarks-hub">
      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-amber-50 text-amber-700 rounded-lg font-bold text-xs">
                📝 PERSONAL HUB
              </span>
              <span className="text-xs font-mono text-slate-500 uppercase font-bold tracking-wider">
                My Knowledge &amp; Bookmarks
              </span>
            </div>
            <h2 className="text-2xl font-extrabold text-slate-900 mt-1">
              My Notes &amp; Bookmarked Topics
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Review personal annotations and study bookmarks saved during your curriculum review.
            </p>
          </div>

          <button
            onClick={exportNotesJson}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-mono font-bold transition-colors flex items-center gap-1.5 shrink-0"
          >
            <span>💾 Backup Notes (JSON)</span>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('notes')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                activeTab === 'notes' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-700'
              }`}
            >
              📝 My Notes ({Object.keys(notes).length})
            </button>
            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`px-4 py-2 rounded-xl text-xs font-mono font-bold transition-all ${
                activeTab === 'bookmarks' ? 'bg-amber-500 text-slate-950 shadow-xs' : 'bg-slate-100 text-slate-700'
              }`}
            >
              📌 Bookmarks ({Object.values(bookmarks).filter(Boolean).length})
            </button>
          </div>

          <input
            type="text"
            placeholder="Search notes & topics..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-400 sm:w-64"
          />
        </div>
      </div>

      <div className="space-y-4">
        {filteredTopics.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center space-y-3">
            <span className="text-3xl">📭</span>
            <h3 className="text-sm font-bold text-slate-800">
              {activeTab === 'notes' ? 'No personal notes created yet.' : 'No bookmarked topics yet.'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Open any module and add personal notes or bookmarks to save key engineering takeaways.
            </p>
          </div>
        ) : (
          filteredTopics.map(item => (
            <div key={item.key} className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold bg-slate-900 text-white px-2 py-0.5 rounded">
                  {item.moduleId} · {item.sectionTitle}
                </span>
              </div>
              <h3 className="text-base font-extrabold text-slate-900">{item.term}</h3>
              <p className="text-xs text-slate-600">{item.definition}</p>
              {item.note && (
                <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl p-3 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-mono font-bold text-amber-800">
                    <span>📝 MY NOTE:</span>
                    <button onClick={() => handleDeleteNote(item.key)} className="text-rose-600 text-[10px]">Delete</button>
                  </div>
                  <p className="text-xs text-slate-800 whitespace-pre-wrap">{item.note}</p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
