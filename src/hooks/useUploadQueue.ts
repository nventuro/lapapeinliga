import { useRef, useState, useCallback, useEffect } from 'react';
import type { UploadFileEntry } from '../utils/mediaUpload';
import { uploadSingleFile } from '../utils/mediaUpload';
import { supabase } from '../lib/supabase';

type FileUploadStatus = 'queued' | 'uploading' | 'done' | 'failed';

interface StatusEntry {
  status: FileUploadStatus;
  error: string | null;
}

interface QueueItem {
  entry: UploadFileEntry;
  eventId: number | null;
  date: string;
}

interface UseUploadQueueOptions {
  eventId: number | null;
  date: string;
  onItemUploaded: () => void;
}

interface UseUploadQueueReturn {
  enqueue: (entry: UploadFileEntry) => void;
  retryFailed: () => void;
  abort: () => void;
  statuses: Map<string, StatusEntry>;
  doneCount: number;
  failedCount: number;
  activeCount: number;
  isIdle: boolean;
}

export function useUploadQueue({
  eventId,
  date,
  onItemUploaded,
}: UseUploadQueueOptions): UseUploadQueueReturn {
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const failedItemsRef = useRef<Map<string, QueueItem>>(new Map());
  // Stable refs for callback values so processQueue always sees latest
  const onItemUploadedRef = useRef(onItemUploaded);
  useEffect(() => {
    onItemUploadedRef.current = onItemUploaded;
  }, [onItemUploaded]);

  const [statuses, setStatuses] = useState<Map<string, StatusEntry>>(new Map());

  const updateStatus = useCallback((id: string, status: FileUploadStatus, error: string | null = null) => {
    setStatuses((prev) => {
      const next = new Map(prev);
      next.set(id, { status, error });
      return next;
    });
  }, []);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    processingRef.current = true;

    if (!abortControllerRef.current) {
      abortControllerRef.current = new AbortController();
    }
    const signal = abortControllerRef.current.signal;

    while (queueRef.current.length > 0) {
      const item = queueRef.current.shift()!;
      updateStatus(item.entry.id, 'uploading');

      try {
        await uploadSingleFile(item.entry, item.eventId, item.date, signal);
        updateStatus(item.entry.id, 'done');
        failedItemsRef.current.delete(item.entry.id);
        onItemUploadedRef.current();
      } catch (err) {
        if (signal.aborted) break;
        const message = err instanceof Error ? err.message : String(err);
        updateStatus(item.entry.id, 'failed', message);
        failedItemsRef.current.set(item.entry.id, item);
      }
    }

    processingRef.current = false;
  }, [updateStatus]);

  const enqueue = useCallback((entry: UploadFileEntry) => {
    // Snapshot the entry so later edits don't affect the queued upload
    const item: QueueItem = {
      entry: { ...entry },
      eventId,
      date,
    };
    queueRef.current.push(item);
    updateStatus(entry.id, 'queued');
    processQueue();
  }, [eventId, date, updateStatus, processQueue]);

  const retryFailed = useCallback(() => {
    // Reset abort controller if it was aborted
    if (abortControllerRef.current?.signal.aborted) {
      abortControllerRef.current = new AbortController();
    }
    for (const [id, item] of failedItemsRef.current) {
      queueRef.current.push(item);
      updateStatus(id, 'queued');
    }
    failedItemsRef.current.clear();
    processQueue();
  }, [updateStatus, processQueue]);

  const abort = useCallback(() => {
    abortControllerRef.current?.abort();
    queueRef.current = [];
  }, []);

  // Visibility recovery: when tab becomes visible again, check if in-flight upload completed
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      // Find any items marked as 'uploading' and verify against DB
      const uploading: string[] = [];
      for (const [id, entry] of statuses) {
        if (entry.status === 'uploading') uploading.push(id);
      }
      if (uploading.length === 0) return;

      for (const id of uploading) {
        // Check if media row with this UUID exists in storage_path
        supabase
          .from('media')
          .select('id')
          .or(`storage_path.like.%${id}%,thumbnail_path.like.%${id}%`)
          .limit(1)
          .then(({ data }) => {
            if (data && data.length > 0) {
              // Upload completed while we were backgrounded
              updateStatus(id, 'done');
              failedItemsRef.current.delete(id);
              onItemUploadedRef.current();
            } else if (!processingRef.current) {
              // Upload didn't complete and we're not processing — mark as failed for retry
              const failedItem = failedItemsRef.current.get(id);
              if (failedItem) {
                updateStatus(id, 'failed', 'Subida interrumpida, reintentá');
              }
            }
          });
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [statuses, updateStatus]);

  // Derive counts from statuses
  let doneCount = 0;
  let failedCount = 0;
  let activeCount = 0;
  for (const entry of statuses.values()) {
    if (entry.status === 'done') doneCount++;
    else if (entry.status === 'failed') failedCount++;
    else activeCount++; // queued or uploading
  }

  return {
    enqueue,
    retryFailed,
    abort,
    statuses,
    doneCount,
    failedCount,
    activeCount,
    isIdle: activeCount === 0,
  };
}
