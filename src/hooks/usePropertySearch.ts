'use client';

import { useState, useCallback, useRef } from 'react';
import type {
  PropertySearchResult,
  PropertySearchQuery,
  SearchStatus,
  SSEEvent,
} from '@/types/property-finder';

export interface UsePropertySearchReturn {
  status: SearchStatus;
  results: PropertySearchResult[];
  parsedQuery: PropertySearchQuery | null;
  statusMessage: string;
  error: string | null;
  search: (query: string) => void;
  reset: () => void;
}

export function usePropertySearch(): UsePropertySearchReturn {
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [results, setResults] = useState<PropertySearchResult[]>([]);
  const [parsedQuery, setParsedQuery] = useState<PropertySearchQuery | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus('idle');
    setStatusMessage('');
    setResults([]);
    setParsedQuery(null);
    setError(null);
  }, []);

  const search = useCallback((query: string) => {
    // Cancel any in-flight search
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('parsing');
    setStatusMessage('Iniciando búsqueda...');
    setResults([]);
    setParsedQuery(null);
    setError(null);

    (async () => {
      try {
        const response = await fetch('/api/property-finder/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          throw new Error(`Error del servidor: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // SSE lines are separated by double newline
          const parts = buffer.split('\n\n');
          // Last element may be incomplete — keep it in buffer
          buffer = parts.pop() ?? '';

          for (const part of parts) {
            const lines = part.split('\n');
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              try {
                const event = JSON.parse(jsonStr) as SSEEvent;
                handleEvent(event);
              } catch {
                // Skip malformed JSON
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        const msg =
          err instanceof Error ? err.message : 'Error de conexión inesperado';
        setError(msg);
        setStatus('error');
        setStatusMessage('');
      }
    })();

    function handleEvent(event: SSEEvent): void {
      switch (event.type) {
        case 'status':
          setStatus(event.status);
          setStatusMessage(event.message);
          break;

        case 'query':
          setParsedQuery(event.parsedQuery);
          break;

        case 'result':
          setResults((prev) => {
            // Merge & keep sorted by matchScore descending
            const next = [...prev, event.result];
            next.sort((a, b) => b.matchScore - a.matchScore);
            return next;
          });
          break;

        case 'complete':
          setStatus('completed');
          setStatusMessage(
            event.totalResults === 0
              ? 'Sin resultados para esta búsqueda.'
              : `${event.totalResults} ${event.totalResults === 1 ? 'resultado encontrado' : 'resultados encontrados'}`
          );
          break;

        case 'error':
          setError(event.message);
          setStatus('error');
          setStatusMessage('');
          break;
      }
    }
  }, []);

  return { status, results, parsedQuery, statusMessage, error, search, reset };
}
