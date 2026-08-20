import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Search, Filter, Clock, User, ArrowRight, Activity, FileText } from 'lucide-react';
import { AuditLogEntry } from '../../types';
import { subscribeToAuditLogs } from '../../services/auditService';

export const AuditLogsViewer: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

  useEffect(() => {
    const unsub = subscribeToAuditLogs(setLogs);
    return () => unsub();
  }, []);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.actor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.order_id && log.order_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.transaction_id && log.transaction_id.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesRole = roleFilter === 'all' || log.actor_role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-emerald-600 flex items-center justify-center text-white shadow-lg">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-black">Authoritative Immutable Audit Log</h2>
            <p className="text-xs text-slate-400">
              System-wide audit trail recording financial, order lifecycle, and courier events
            </p>
          </div>
        </div>
        <div className="text-right bg-slate-800 px-4 py-2 rounded-2xl border border-slate-700">
          <span className="text-[10px] font-bold text-slate-400 uppercase block">Total Recorded Logs</span>
          <span className="text-base font-black text-emerald-400">{logs.length} Events</span>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by Action, Actor, Order ID, or Transaction Reference..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-xs font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-600"
          />
        </div>

        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-700 outline-none"
        >
          <option value="all">All Actor Roles</option>
          <option value="customer">Customer</option>
          <option value="vendor">Vendor Kitchen</option>
          <option value="rider">Rider / Courier</option>
          <option value="admin">Administrator</option>
          <option value="super_admin">Super Admin</option>
        </select>
      </div>

      {/* Logs Table / List */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <FileText className="w-10 h-10 mx-auto opacity-40" />
            <p className="text-xs font-bold">No audit entries matching search criteria.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredLogs.map((entry) => (
              <div key={entry.id} className="p-4 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[10px] text-slate-400">{entry.id}</span>
                    <span className="font-black px-2 py-0.5 rounded-full text-[10px] uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {entry.action}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-slate-700">
                    <User className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold">{entry.actor_name}</span>
                    <span className="text-[10px] text-slate-400 uppercase font-extrabold">({entry.actor_role})</span>
                    {entry.order_id && (
                      <span className="font-mono text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded text-[10px]">
                        Order #{entry.order_id.slice(-6)}
                      </span>
                    )}
                    {entry.transaction_id && (
                      <span className="font-mono text-blue-700 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[10px]">
                        Tx: {entry.transaction_id.slice(-8)}
                      </span>
                    )}
                  </div>

                  {(entry.previous_state || entry.new_state) && (
                    <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                      <span className="line-through">{entry.previous_state || 'none'}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="font-bold text-slate-900">{entry.new_state}</span>
                    </div>
                  )}
                </div>

                <div className="text-right sm:shrink-0 text-slate-400 text-[11px] font-mono">
                  <div className="flex items-center gap-1 justify-end">
                    <Clock className="w-3.5 h-3.5" />
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
