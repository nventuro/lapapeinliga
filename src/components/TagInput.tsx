import { useState, useRef, useEffect } from 'react';
import type { MediaTag } from '../types';

interface TagInputProps {
  allTags: MediaTag[];
  selectedTags: MediaTag[];
  onChange: (tags: MediaTag[]) => void;
  onCreateTag: (name: string) => Promise<MediaTag | null>;
}

export default function TagInput({ allTags, selectedTags, onChange, onCreateTag }: TagInputProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const selectedIds = new Set(selectedTags.map((t) => t.id));
  const trimmed = query.trim().toLowerCase();

  const suggestions = allTags.filter(
    (tag) => !selectedIds.has(tag.id) && tag.name.toLowerCase().includes(trimmed),
  );

  const exactMatch = allTags.some((tag) => tag.name.toLowerCase() === trimmed);
  const showCreate = trimmed.length > 0 && !exactMatch;

  function removeTag(tagId: number) {
    onChange(selectedTags.filter((t) => t.id !== tagId));
  }

  function selectTag(tag: MediaTag) {
    onChange([...selectedTags, tag]);
    setQuery('');
    setOpen(false);
  }

  async function createAndSelect() {
    const newTag = await onCreateTag(trimmed);
    if (newTag) {
      onChange([...selectedTags, newTag]);
      setQuery('');
      setOpen(false);
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      {/* Selected tags */}
      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedTags.map((tag) => (
            <span key={tag.id} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full">
              {tag.name}
              <button onClick={() => removeTag(tag.id)} className="hover:text-error transition-colors">&times;</button>
            </span>
          ))}
        </div>
      )}

      {/* Input */}
      <input
        type="text"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Agregar etiqueta..."
        className="w-full px-3 py-1.5 border border-border rounded-lg text-sm bg-surface text-on-surface placeholder:text-muted"
      />

      {/* Dropdown */}
      {open && (suggestions.length > 0 || showCreate) && (
        <div className="absolute z-20 w-full mt-1 border border-border rounded-lg bg-surface shadow-md max-h-40 overflow-y-auto">
          {suggestions.map((tag) => (
            <button
              key={tag.id}
              onClick={() => selectTag(tag)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-border-subtle transition-colors"
            >
              {tag.name}
            </button>
          ))}
          {showCreate && (
            <button
              onClick={createAndSelect}
              className="w-full text-left px-3 py-2 text-sm text-primary hover:bg-border-subtle transition-colors"
            >
              Crear &ldquo;{trimmed}&rdquo;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
