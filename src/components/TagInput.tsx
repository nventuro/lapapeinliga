import { useState } from 'react';
import type { MediaTag } from '../types';

interface TagInputProps {
  allTags: MediaTag[];
  selectedTags: MediaTag[];
  onChange: (tags: MediaTag[]) => void;
  onCreateTag: (name: string) => Promise<MediaTag | null>;
}

export default function TagInput({ allTags, selectedTags, onChange, onCreateTag }: TagInputProps) {
  const [newTagName, setNewTagName] = useState('');
  const [creating, setCreating] = useState(false);
  const [showNewInput, setShowNewInput] = useState(false);

  const selectedIds = new Set(selectedTags.map((t) => t.id));

  function toggleTag(tag: MediaTag) {
    if (selectedIds.has(tag.id)) {
      onChange(selectedTags.filter((t) => t.id !== tag.id));
    } else {
      onChange([...selectedTags, tag]);
    }
  }

  async function handleCreate() {
    const trimmed = newTagName.trim();
    if (!trimmed) return;
    setCreating(true);
    const tag = await onCreateTag(trimmed);
    if (tag) {
      onChange([...selectedTags, tag]);
      setNewTagName('');
    }
    setCreating(false);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {allTags.map((tag) => {
        const isActive = selectedIds.has(tag.id);
        return (
          <button
            key={tag.id}
            type="button"
            onClick={() => toggleTag(tag)}
            className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
              isActive
                ? 'bg-primary text-on-primary'
                : 'bg-border-subtle text-muted hover:text-muted-strong'
            }`}
          >
            {tag.name}
          </button>
        );
      })}
      {showNewInput ? (
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); handleCreate(); }
            if (e.key === 'Escape') { setShowNewInput(false); setNewTagName(''); }
          }}
          placeholder="Nombre..."
          autoFocus
          disabled={creating}
          onBlur={() => { if (!newTagName.trim()) { setShowNewInput(false); setNewTagName(''); } }}
          className="w-24 px-2.5 py-0.5 rounded-full text-xs border border-border bg-surface text-on-surface placeholder:text-muted disabled:opacity-50"
        />
      ) : (
        <button
          type="button"
          onClick={() => setShowNewInput(true)}
          className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-border-subtle text-muted hover:text-muted-strong transition-colors"
        >
          +
        </button>
      )}
    </div>
  );
}
