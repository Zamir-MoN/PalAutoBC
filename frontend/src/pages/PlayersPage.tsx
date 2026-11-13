import React, { useState, useEffect, useRef } from 'react';
import { Users, UserX, Ban, MessageSquare, Save, RefreshCw, Shield, AlertCircle } from 'lucide-react';
import { api } from '../services/api';
import { Player } from '../types';
import { animatePageEntrance } from '../animations/gsap';

export function PlayersPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [broadcastMsg, setBroadcastMsg] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const res = await api.getOnlinePlayers();
      setPlayers(res.players || []);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to query players via RCON');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    animatePageEntrance(containerRef.current);
    loadPlayers();
  }, []);

  const handleKick = async (steamId: string, name: string) => {
    if (!window.confirm(`Kick player ${name} (${steamId}) from server?`)) return;
    try {
      const res = await api.kickPlayer(steamId);
      setActionMsg(res.message);
      loadPlayers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to kick player');
    }
  };

  const handleBan = async (steamId: string, name: string) => {
    if (!window.confirm(`Permanently ban player ${name} (${steamId})?`)) return;
    try {
      const res = await api.banPlayer(steamId);
      setActionMsg(res.message);
      loadPlayers();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to ban player');
    }
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!broadcastMsg.trim()) return;

    try {
      const res = await api.broadcastMessage(broadcastMsg);
      setActionMsg(`Broadcast sent: "${broadcastMsg}"`);
      setBroadcastMsg('');
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to send broadcast');
    }
  };

  const handleSaveWorld = async () => {
    try {
      const res = await api.saveWorld();
      setActionMsg(res.message);
    } catch (err: any) {
      setErrorMsg(err.message || 'World save failed');
    }
  };

  return (
    <div ref={containerRef} className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            Player Administration
          </h1>
          <p className="text-xs text-mutedText mt-0.5">
            Real-time player monitoring, in-game announcements, and moderation via RCON
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveWorld}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-border text-white border border-border transition-colors"
          >
            <Save className="w-3.5 h-3.5 text-accent" />
            <span>Save World</span>
          </button>
          <button
            onClick={loadPlayers}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-border text-white border border-border transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {actionMsg && (
        <div className="p-3.5 rounded-xl bg-success/10 border border-success/30 text-success text-xs flex items-center justify-between">
          <span>{actionMsg}</span>
          <button onClick={() => setActionMsg('')} className="hover:opacity-75">✕</button>
        </div>
      )}

      {errorMsg && (
        <div className="p-3.5 rounded-xl bg-danger/10 border border-danger/30 text-danger text-xs flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg('')} className="hover:opacity-75">✕</button>
        </div>
      )}

      {/* Broadcast Banner Card */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-accent" />
          Server Broadcast Announcement
        </h2>
        <form onSubmit={handleBroadcast} className="flex gap-2">
          <input
            type="text"
            value={broadcastMsg}
            onChange={(e) => setBroadcastMsg(e.target.value)}
            placeholder="Type server announcement message..."
            className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-accent"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-accent text-black font-semibold text-xs rounded-lg hover:bg-accent-hover transition-colors"
          >
            Send Broadcast
          </button>
        </form>
      </div>

      {/* Players List Table */}
      <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-white">
            Online Players ({players.length})
          </h2>
          <span className="text-xs font-mono text-mutedText">Source: Dedicated RCON</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border/80 text-mutedText font-medium">
                <th className="pb-3 pl-2">Player Name</th>
                <th className="pb-3">Player UID</th>
                <th className="pb-3">Steam ID</th>
                <th className="pb-3 pr-2 text-right">Moderation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40 font-mono">
              {players.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-8 text-center text-mutedText font-sans">
                    No players currently connected to the server.
                  </td>
                </tr>
              ) : (
                players.map((p) => (
                  <tr key={p.steamId} className="hover:bg-secondary/40 transition-colors">
                    <td className="py-3 pl-2 font-semibold text-white flex items-center gap-2 font-sans">
                      <span className="w-2 h-2 rounded-full bg-success" />
                      <span>{p.name}</span>
                    </td>
                    <td className="py-3 text-secondaryText">{p.playerUId}</td>
                    <td className="py-3 text-secondaryText">{p.steamId}</td>
                    <td className="py-3 pr-2 text-right space-x-2 font-sans">
                      <button
                        onClick={() => handleKick(p.steamId, p.name)}
                        className="px-2 py-1 rounded bg-secondary hover:bg-warning/20 hover:text-warning border border-border text-[11px] font-medium transition-colors"
                      >
                        Kick
                      </button>
                      <button
                        onClick={() => handleBan(p.steamId, p.name)}
                        className="px-2 py-1 rounded bg-secondary hover:bg-danger/20 hover:text-danger border border-border text-[11px] font-medium transition-colors"
                      >
                        Ban
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

