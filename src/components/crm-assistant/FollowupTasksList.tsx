'use client';

import { useEffect, useState, useCallback } from 'react';
import { Clock, RefreshCw, MessageCircle } from 'lucide-react';
import type { FollowupTaskRecord } from '@/types/crm-assistant';

function formatDueDate(iso: string): string {
  const date = new Date(iso);
  const today = new Date();
  const diffDays = Math.round((date.getTime() - today.setHours(0, 0, 0, 0)) / 86_400_000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  if (diffDays < 0) return `Vencido hace ${Math.abs(diffDays)}d`;
  return `En ${diffDays}d · ${date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short' })}`;
}

export interface FollowupTasksListHandle {
  refresh: () => void;
}

interface FollowupTasksListProps {
  refreshKey: number;
}

export function FollowupTasksList({ refreshKey }: FollowupTasksListProps) {
  const [tasks, setTasks] = useState<FollowupTaskRecord[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/crm/followup-tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
      }
    } catch (err) {
      console.warn('[FollowupTasksList] failed to load:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <div className="rounded-card border border-border bg-surface p-4 space-y-3 h-full overflow-hidden flex flex-col">
      <div className="flex items-center justify-between shrink-0">
        <h3 className="text-xs font-semibold text-secondary uppercase tracking-wide flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" />
          Seguimientos pendientes
        </h3>
        <button
          type="button"
          onClick={load}
          disabled={isLoading}
          className="p-1 rounded text-muted hover:text-accent transition-colors disabled:opacity-40"
          title="Actualizar"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {tasks === null && <p className="text-2xs text-muted">Cargando…</p>}
        {tasks !== null && tasks.length === 0 && <p className="text-2xs text-muted">No hay seguimientos pendientes.</p>}
        {tasks?.map((task) => (
          <div key={task.id} className="rounded-subtle border border-border-subtle bg-background p-2.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground truncate">{task.contact.name}</span>
              <span className="text-2xs text-accent font-mono shrink-0 ml-2">{formatDueDate(task.dueAt)}</span>
            </div>
            <p className="text-2xs text-muted line-clamp-2 flex items-start gap-1">
              <MessageCircle className="w-3 h-3 shrink-0 mt-0.5" />
              <span>{task.suggestedMessage}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
