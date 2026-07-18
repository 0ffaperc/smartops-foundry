import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../App';
import GlowCard from '../components/GlowCard';
import { exportData, importData } from '../lib/storage';
import {
  Settings as SettingsIcon, Key, Database, Download, Upload,
  Sun, Moon, ExternalLink, CheckCircle2, Copy,
} from 'lucide-react';

export default function Settings() {
  const { settings, setSettings } = useApp();
  const [copySuccess, setCopySuccess] = useState(false);
  const [importStatus, setImportStatus] = useState(null);

  const handleChange = (key, value) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const handleExport = () => {
    const data = exportData();
    if (!data) return;
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = importData(ev.target?.result);
        if (result) {
          setImportStatus('success');
          setTimeout(() => window.location.reload(), 1000);
        } else {
          setImportStatus('error');
        }
      };
      reader.readAsText(file);
    };
    input.click();
  };

  const handleCopyData = () => {
    const data = exportData();
    if (!data) return;
    navigator.clipboard.writeText(data).then(() => {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    });
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-3xl lg:text-4xl font-bold">Settings</h1>
        <p className="text-white/40 mt-1 text-sm">Configure your LifeOS experience</p>
      </div>

      {/* Model Routing */}
      <GlowCard glowColor="gold">
        <div className="flex items-center gap-2 mb-5">
          <Key className="w-5 h-5 text-gold-400" strokeWidth={1.5} />
          <h2 className="text-base font-semibold">Model Routing</h2>
        </div>
        <div className="space-y-4">
          {[
            { key: 'dailyReviewModel', label: 'Daily Review Model', default: 'google/gemini-2.5-flash' },
            { key: 'plannerModel', label: 'Planner Model', default: 'anthropic/claude-haiku-4.5' },
            { key: 'criticModel', label: 'Critic Model', default: 'anthropic/claude-haiku-4.5' },
            { key: 'premiumModel', label: 'Premium Model', default: 'anthropic/claude-haiku-4.5' },
            { key: 'orchestratorModel', label: 'Orchestrator Model', default: 'anthropic/claude-haiku-4.5' },
          ].map((field) => (
            <div key={field.key}>
              <label className="text-xs text-white/40 font-medium mb-1.5 block">{field.label}</label>
              <div className="flex items-center gap-2">
                <input
                  value={settings[field.key] || field.default}
                  onChange={(e) => handleChange(field.key, e.target.value)}
                  className="flex-1 px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white placeholder:text-white/20 focus:border-gold-500/30 transition-all font-mono"
                />
                <span className="text-[10px] text-white/20 font-mono">default: {field.default}</span>
              </div>
            </div>
          ))}
        </div>
      </GlowCard>

      {/* API Key */}
      <GlowCard>
        <div className="flex items-center gap-2 mb-5">
          <Key className="w-5 h-5 text-white/30" strokeWidth={1.5} />
          <h2 className="text-base font-semibold">OpenRouter API Key</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-400 border border-gold-500/20">Placeholder</span>
        </div>
        <div>
          <label className="text-xs text-white/40 font-medium mb-1.5 block">API Key</label>
          <input
            type="password"
            value={settings.apiKey || ''}
            onChange={(e) => handleChange('apiKey', e.target.value)}
            placeholder="sk-or-v1-..."
            className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/70 border border-white/[0.06] text-sm text-white placeholder:text-white/15 focus:border-gold-500/30 transition-all font-mono"
          />
          <p className="text-xs text-white/20 mt-2">
            Your API key is stored locally and never sent anywhere except to OpenRouter.
          </p>
        </div>
      </GlowCard>

      {/* Theme */}
      <GlowCard>
        <div className="flex items-center gap-2 mb-5">
          <Sun className="w-5 h-5 text-white/30" strokeWidth={1.5} />
          <h2 className="text-base font-semibold">Theme</h2>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold-500/10 text-gold-400 border border-gold-500/20">Placeholder</span>
        </div>
        <div className="flex gap-3">
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-gold-500/10 border border-gold-500/20 text-gold-400 text-sm font-medium flex-1">
            <Moon className="w-4 h-4" strokeWidth={1.5} />
            Dark (Default)
          </button>
          <button className="flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-200/50 border border-white/[0.06] text-white/30 text-sm flex-1 opacity-50 cursor-not-allowed">
            <Sun className="w-4 h-4" strokeWidth={1.5} />
            Light (Coming Soon)
          </button>
        </div>
      </GlowCard>

      {/* Data Management */}
      <GlowCard>
        <div className="flex items-center gap-2 mb-5">
          <Database className="w-5 h-5 text-white/30" strokeWidth={1.5} />
          <h2 className="text-base font-semibold">Data Management</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/15 transition-all"
          >
            <Download className="w-4 h-4" strokeWidth={1.5} />
            Export Data
          </button>
          <button
            onClick={handleImport}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-blue/10 border border-accent-blue/20 text-accent-blue text-sm font-medium hover:bg-accent-blue/15 transition-all"
          >
            <Upload className="w-4 h-4" strokeWidth={1.5} />
            Import Data
          </button>
          <button
            onClick={handleCopyData}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-200/50 border border-white/[0.06] text-white/50 text-sm font-medium hover:text-white/70 transition-all"
          >
            {copySuccess ? (
              <><CheckCircle2 className="w-4 h-4 text-emerald-400" strokeWidth={1.5} /> Copied!</>
            ) : (
              <><Copy className="w-4 h-4" strokeWidth={1.5} /> Copy Raw Data</>
            )}
          </button>
        </div>
        {importStatus === 'success' && (
          <p className="text-xs text-emerald-400 mt-3">Data imported! Reloading...</p>
        )}
        {importStatus === 'error' && (
          <p className="text-xs text-rose-400 mt-3">Invalid data file. Please check the format.</p>
        )}
      </GlowCard>

      {/* Version */}
      <div className="text-center py-4">
        <p className="text-xs text-white/15 font-mono">LifeOS V2 · Build 2026.06.13</p>
        <p className="text-[10px] text-white/10 mt-1">Data stored in localStorage</p>
      </div>
    </div>
  );
}






