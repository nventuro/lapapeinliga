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
  trophyId: number | null;
  date: string;
}

interface UseUploadQueueOptions {
  eventId: number | null;
  /** Set when the batch is being uploaded from a trophy's page. */
  trophyId?: number | null;
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
  trophyId = null,
  date,
  onItemUploaded,
}: UseUploadQueueOptions): UseUploadQueueReturn {
  const queueRef = useRef<QueueItem[]>([]);
  const processingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const failedItemsRef = useRef<Map<string, QueueItem>>(new Map());
  // Every item ever enqueued, so interrupted uploads (whose QueueItem is gone
  // with the dead processQueue run) can still be resurrected for retry.
  const allItemsRef = useRef<Map<string, QueueItem>>(new Map());
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

    // Outer loop: an enqueue that races an aborted run's teardown lands in
    // the queue after abort() cleared it but while processing was still true,
    // so its own processQueue() call no-oped. Re-checking here picks those
    // items up with a fresh controller instead of stranding them in 'queued'.
    while (queueRef.current.length > 0) {
      if (!abortControllerRef.current) {
        abortControllerRef.current = new AbortController();
      }
      const signal = abortControllerRef.current.signal;
      if (signal.aborted) break;

      while (queueRef.current.length > 0) {
        const item = queueRef.current.shift()!;
        updateStatus(item.entry.id, 'uploading');

        try {
          await uploadSingleFile(item.entry, item.eventId, item.date, signal, item.trophyId);
          updateStatus(item.entry.id, 'done');
          failedItemsRef.current.delete(item.entry.id);
          onItemUploadedRef.current();
        } catch (err) {
          // On abort the item still must leave 'uploading', or it counts as
          // active forever and the dialog's close button never re-enables.
          const message = signal.aborted
            ? 'Subida cancelada'
            : err instanceof Error ? err.message : String(err);
          updateStatus(item.entry.id, 'failed', message);
          failedItemsRef.current.set(item.entry.id, item);
          if (signal.aborted) break;
        }
      }
    }

    processingRef.current = false;
  }, [updateStatus]);

  const enqueue = useCallback((entry: UploadFileEntry) => {
    // Snapshot the entry so later edits don't affect the queued upload
    const item: QueueItem = {
      entry: { ...entry },
      eventId,
      trophyId,
      date,
    };
    queueRef.current.push(item);
    allItemsRef.current.set(entry.id, item);
    updateStatus(entry.id, 'queued');
    processQueue();
  }, [eventId, trophyId, date, updateStatus, processQueue]);

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
    // A fresh controller for anything enqueued later: without this, every
    // future enqueue would see the already-aborted signal and dead-end.
    abortControllerRef.current = null;
    // Queued items are dropped from the queue but must not stay 'queued' in
    // the UI; park them as failed so retry can pick them up.
    for (const item of queueRef.current) {
      updateStatus(item.entry.id, 'failed', 'Subida cancelada');
      failedItemsRef.current.set(item.entry.id, item);
    }
    queueRef.current = [];
  }, [updateStatus]);

  // Visibility recovery: when tab becomes visible again, check if in-flight upload completed
  useEffect(() => {
    let cancelled = false;

    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;

      // Find any items marked as 'uploading' and verify against DB
      const uploading: string[] = [];
      for (const [id, entry] of statuses) {
        if (entry.status === 'uploading') uploading.push(id);
      }
      if (uploading.length === 0) return;

      // One probe for all of them: each item's UUID appears in its storage_path.
      // (Ids are client-generated UUIDs, so interpolating them is safe.)
      supabase
        .from('media')
        .select('storage_path')
        .or(uploading.map((id) => `storage_path.like.%${id}%`).join(','))
        .then(({ data, error }) => {
          if (cancelled || error) return;
          const found = (id: string) => (data ?? []).some((row) => row.storage_path.includes(id));
          for (const id of uploading) {
            if (found(id)) {
              // Upload completed while we were backgrounded
              updateStatus(id, 'done');
              failedItemsRef.current.delete(id);
              onItemUploadedRef.current();
            } else if (!processingRef.current) {
              // No row and nothing is processing: the upload was interrupted.
              // The QueueItem died with the interrupted run, so resurrect it
              // from allItemsRef to make retry possible.
              const item = allItemsRef.current.get(id);
              if (item) failedItemsRef.current.set(id, item);
              updateStatus(id, 'failed', 'Subida interrumpida, reintentá');
            }
          }
        });
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
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
