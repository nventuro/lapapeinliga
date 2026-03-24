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
    <div className="space-y-2">
      {/* Tag chips */}
      {allTags.length > 0 && (
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
        </div>
      )}

      {/* New tag input */}
      <div className="flex gap-1.5">
        <input
          type="text"
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleCreate(); } }}
          placeholder="Nueva etiqueta..."
          className="flex-1 px-2 py-1 border border-border rounded text-xs bg-surface text-on-surface placeholder:text-muted"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={!newTagName.trim() || creating}
          className="px-2 py-1 text-xs font-medium text-primary hover:text-primary-hover disabled:text-disabled transition-colors"
        >
          +
        </button>
      </div>
    </div>
  );
}
