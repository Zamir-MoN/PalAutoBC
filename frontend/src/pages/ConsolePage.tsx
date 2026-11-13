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
    api.getConsoleLogs(150).then(setLogs).catch(() => {});

    // Live WebSocket log streaming
    const unsub = subscribe('CONSOLE_LOG', (entry: ConsoleLog) => {
      if (!isPaused) {
        setLogs((prev) => [...prev.slice(-400), entry]);
      }
    });

    return unsub;
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

    try {
      await api.sendConsoleCommand(cmd);
    } catch {}
    setExecuting(false);
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
      <div className="flex gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search console logs..."
            className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-mutedText focus:outline-none focus:border-accent"
          />
          <Search className="w-3.5 h-3.5 text-mutedText absolute left-2.5 top-2.5" />
        </div>

        <select
          value={filterLevel}
          onChange={(e) => setFilterLevel(e.target.value)}
          className="bg-card border border-border rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-accent font-mono"
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
        className="flex-1 bg-secondary border border-border rounded-xl p-4 font-mono text-xs overflow-y-auto space-y-1 shadow-inner select-text"
      >
        {filteredLogs.length === 0 ? (
          <div className="text-mutedText italic text-center py-10">No log entries matching criteria.</div>
        ) : (
          filteredLogs.map((log) => {
            let color = 'text-secondaryText';
            if (log.level === 'ERROR') color = 'text-danger font-semibold';
            if (log.level === 'WARN') color = 'text-warning';
            if (log.level === 'DEBUG') color = 'text-mutedText';

            return (
              <div key={log.id} className="leading-relaxed hover:bg-card/40 px-1 rounded flex gap-2">
                <span className="text-mutedText/70 select-none flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span
                  className={`px-1 py-0.2 rounded text-[10px] font-bold flex-shrink-0 select-none ${
                    log.level === 'ERROR'
                      ? 'bg-danger/20 text-danger'
                      : log.level === 'WARN'
                      ? 'bg-warning/20 text-warning'
                      : 'bg-card text-mutedText'
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
      <form onSubmit={handleSendCommand} className="flex gap-2 flex-shrink-0">
        <div className="relative flex-1">
          <input
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            placeholder="Type administrative command (e.g. Save, ShowPlayers, Broadcast <msg>, KickPlayer <id>)..."
            className="w-full bg-card border border-border rounded-lg pl-8 pr-3 py-2 text-xs text-white placeholder-mutedText focus:outline-none focus:border-accent font-mono"
          />
          <Terminal className="w-3.5 h-3.5 text-accent absolute left-2.5 top-3" />
        </div>
        <button
          type="submit"
          disabled={executing || !commandInput.trim()}
          className="px-4 py-2 bg-accent text-black font-semibold text-xs rounded-lg hover:bg-accent-hover transition-colors flex items-center gap-1.5 disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Execute</span>
        </button>
      </form>
    </div>
  );
}

