import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Play,
  Pause,
  Trash2,
  Copy,
  Search,
  Filter,
  Send,
  Check,
  ChevronDown,
} from 'lucide-react';
import { api } from '../services/api';
import { ConsoleLog } from '../types';
import { useWebSocket } from '../hooks/useWebSocket';
import { animatePageEntrance } from '../animations/gsap';

export function ConsolePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);
  const { subscribe } = useWebSocket();

  const [logs, setLogs] = useState<ConsoleLog[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isPaused, setIsPaused] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [commandInput, setCommandInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    animatePageEntrance(containerRef.current);

    // Initial recent logs
    api.getConsoleLogs(150).then((data) => {
      if (Array.isArray(data)) setLogs(data);
    }).catch(() => {});

    // Periodic sync backup (every 3s) in case WebSocket has latency
    const pollInterval = setInterval(() => {
      if (!isPaused) {
        api.getConsoleLogs(150).then((data) => {
          if (Array.isArray(data) && data.length > 0) {
            setLogs((prev) => {
              const existingIds = new Set(prev.map((l) => l.id));
              const newEntries = data.filter((d) => !existingIds.has(d.id));
              if (newEntries.length === 0) return prev;
              return [...prev, ...newEntries].slice(-500);
            });
          }
        }).catch(() => {});
      }
    }, 3000);

    // Live WebSocket log streaming
    const unsub = subscribe('CONSOLE_LOG', (entry: ConsoleLog) => {
      if (!isPaused && entry) {
        setLogs((prev) => {
          if (prev.some((l) => l.id === entry.id)) return prev;
          return [...prev.slice(-400), entry];
        });
      }
    });

    return () => {
      clearInterval(pollInterval);
      unsub();
    };
  }, [subscribe, isPaused]);

  // Auto-scroll effect
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleSendCommand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commandInput.trim() || executing) return;

    const cmd = commandInput.trim();
    setCommandInput('');
    setExecuting(true);

    // Immediate optimistic local feedback
    const userLog: ConsoleLog = {
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      level: 'INFO',
      message: `> ${cmd}`,
    };
    setLogs((prev) => [...prev, userLog]);

    try {
      const res = await api.sendConsoleCommand(cmd);
      if (res && res.output) {
        setLogs((prev) => [
          ...prev,
          {
            id: Math.random().toString(36).substring(2, 9),
            timestamp: new Date().toISOString(),
            level: 'INFO',
            message: res.output,
          },
        ]);
      }
    } catch (err: any) {
      setLogs((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          level: 'ERROR',
          message: err.message || 'Command delivery failed.',
        },
      ]);
    } finally {
      setExecuting(false);
    }
  };

  const handleCopyLogs = () => {
    const text = filteredLogs.map((l) => `[${l.timestamp}] [${l.level}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const filteredLogs = logs.filter((log) => {
    if (filterLevel !== 'ALL' && log.level !== filterLevel) return false;
    if (searchQuery && !log.message.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div ref={containerRef} className="space-y-4 max-w-6xl mx-auto flex flex-col h-[calc(100vh-6.5rem)]">
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-shrink-0">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Terminal className="w-5 h-5 text-accent" />
            Live Dedicated Server Console
          </h1>
          <p className="text-xs text-mutedText mt-0.5">Real-time log streaming, log level filtering, and administrative command terminal</p>
        </div>

        {/* Toolbar buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              isPaused
                ? 'bg-warning/15 text-warning border-warning/30'
                : 'bg-card text-secondaryText hover:text-white border-border'
            }`}
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>

          <button
            onClick={handleCopyLogs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-border text-secondaryText hover:text-white border border-border transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <button
            onClick={() => setLogs([])}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-border text-secondaryText hover:text-white border border-border transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear</span>
          </button>

          <label className="flex items-center gap-1.5 text-xs text-secondaryText cursor-pointer ml-1 select-none">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="w-3.5 h-3.5 rounded bg-secondary border-border text-accent focus:ring-accent"
            />
            <span>Auto-scroll</span>
          </label>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex gap-2.5 flex-shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search console logs..."
            className="w-full bg-[#101218] border border-white/[0.08] focus:border-accent rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-mutedText focus:outline-none transition-colors"
          />
          <Search className="w-3.5 h-3.5 text-mutedText absolute left-3 top-2.5" />
        </div>

        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="bg-[#101218] border border-white/[0.08] focus:border-accent rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none font-mono"
        >
          <option value="ALL">All Levels</option>
          <option value="INFO">INFO Only</option>
          <option value="WARN">WARN Only</option>
          <option value="ERROR">ERROR Only</option>
        </select>
      </div>

      {/* Log Terminal Window */}
      <div
        ref={logContainerRef}
        className="flex-1 bg-[#090A0E]/95 border border-white/[0.08] rounded-2xl p-4 font-mono text-xs overflow-y-auto space-y-1.5 shadow-[inset_0_2px_10px_rgba(0,0,0,0.8)] select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-mutedText italic text-center py-12">No log entries matching criteria.</div>
        ) : (
          filteredLogs.map((log) => {
            let color = 'text-zinc-300';
            if (log.level === 'ERROR') color = 'text-red-400 font-semibold';
            if (log.level === 'WARN') color = 'text-amber-300';
            if (log.level === 'DEBUG') color = 'text-mutedText';

            return (
              <div key={log.id} className="leading-relaxed hover:bg-white/[0.04] px-2 py-0.5 rounded-md flex gap-2.5 transition-colors">
                <span className="text-mutedText/60 select-none flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={`px-1.5 py-0.2 rounded text-[10px] font-bold flex-shrink-0 select-none border ${
                    log.level === 'ERROR'
                      ? 'bg-danger/20 text-danger border-danger/30'
                      : log.level === 'WARN'
                      ? 'bg-warning/20 text-warning border-warning/30'
                      : 'bg-white/[0.04] text-mutedText border-white/[0.06]'
                  }`}
                >
                  {log.level}
                </span>
                <span className={`${color} break-all`}>{log.message}</span>
              </div>
            );
          })
        )}
      </div>

      {/* Interactive Command Terminal Input */}
      <form onSubmit={handleSendCommand} className="flex gap-2.5 flex-shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type administrative command (e.g. Save, ShowPlayers, Broadcast <msg>, KickPlayer <id>)..."
            className="w-full bg-[#101218] border border-white/[0.08] focus:border-accent rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-mutedText focus:outline-none font-mono transition-colors"
          />
          <Terminal className="w-3.5 h-3.5 text-accent absolute left-3 top-3.5" />
        </div>
        <button
          type="submit"
          disabled={executing || !commandInput.trim()}
          className="px-5 py-2.5 bg-accent text-black font-bold text-xs rounded-xl hover:bg-accent-hover transition-all flex items-center gap-2 disabled:opacity-50 shadow-[0_0_15px_-3px_rgba(163,230,53,0.35)]"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Execute</span>
        </button>
      </form>
    </div>
  );
}

