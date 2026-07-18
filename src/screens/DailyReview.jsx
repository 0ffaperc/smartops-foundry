import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../App';
import GlowCard from '../components/GlowCard';
import { createReview } from '../lib/storage';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';
import {
  FileText, Smile, Zap, Star, AlertTriangle,
  BookOpen, ArrowRight, Brain, Clock, Sparkles,
} from 'lucide-react';
import { mockGenerateReviewSummary } from '../lib/mockAi';

export default function DailyReview() {
  const { reviews, setReviews, today } = useApp();
  const [mood, setMood] = useState(7);
  const [energy, setEnergy] = useState(7);
  const [wins, setWins] = useState('');
  const [mistakes, setMistakes] = useState('');
  const [notes, setNotes] = useState('');
  const [tomorrowFocus, setTomorrowFocus] = useState('');
  const [aiSummary, setAiSummary] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  const todayReview = reviews.find((r) => r.date === today);
  const pastReviews = reviews
    .filter((r) => r.date !== today)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 10);

  // If there's a review for today, load it
  React.useEffect(() => {
    if (todayReview) {
      setMood(todayReview.mood);
      setEnergy(todayReview.energy);
      setWins(todayReview.wins || '');
      setMistakes(todayReview.mistakes || '');
      setNotes(todayReview.notes || '');
      setTomorrowFocus(todayReview.tomorrowFocus || '');
    }
  }, [todayReview?.id]);

  const handleSave = () => {
    const review = {
      id: todayReview?.id || uuidv4(),
      date: today,
      mood: Number(mood),
      energy: Number(energy),
      wins,
      mistakes,
      notes,
      tomorrowFocus,
      aiSummary: aiSummary?.summary || '',
    };

    if (todayReview) {
      setReviews((prev) => prev.map((r) => (r.id === todayReview.id ? review : r)));
    } else {
      setReviews((prev) => [...prev, review]);
    }
  };

  const handleAiReview = async () => {
    setAiLoading(true);
    const result = await mockGenerateReviewSummary({
      mood: Number(mood),
      energy: Number(energy),
      wins,
      mistakes,
      notes,
      tomorrowFocus,
    });
    setAiSummary(result);
    setAiLoading(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl lg:text-4xl font-bold">Daily Review</h1>
          <p className="text-white/40 mt-1 text-sm">{format(new Date(today), 'EEEE, MMMM do, yyyy')}</p>
        </div>
        <button
          onClick={handleSave}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-gold-500 to-gold-600 text-black text-sm font-semibold hover:from-gold-400 hover:to-gold-500 transition-all shadow-lg shadow-gold-500/20"
        >
          <Star className="w-4 h-4" strokeWidth={1.5} />
          <span>{todayReview ? 'Update Review' : 'Save Review'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6">
        {/* Left: Review Form */}
        <div className="space-y-4">
          {/* Mood & Energy */}
          <GlowCard glowColor="gold">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-white/40 font-medium mb-2 flex items-center gap-1.5">
                  <Smile className="w-3.5 h-3.5 text-gold-400" strokeWidth={1.5} />
                  Mood
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={mood}
                    onChange={(e) => setMood(e.target.value)}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-surface-300/50 accent-gold-400 cursor-pointer"
                  />
                  <span className="text-lg font-bold text-gold-400 w-8 text-center">{mood}</span>
                </div>
              </div>
              <div>
                <label className="text-xs text-white/40 font-medium mb-2 flex items-center gap-1.5">
                  <Zap className="w-3.5 h-3.5 text-gold-400" strokeWidth={1.5} />
                  Energy
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={energy}
                    onChange={(e) => setEnergy(e.target.value)}
                    className="flex-1 h-1.5 rounded-full appearance-none bg-surface-300/50 accent-gold-400 cursor-pointer"
                  />
                  <span className="text-lg font-bold text-gold-400 w-8 text-center">{energy}</span>
                </div>
              </div>
            </div>
          </GlowCard>

          {/* Wins */}
          <GlowCard>
            <label className="text-xs text-white/40 font-medium mb-2 flex items-center gap-1.5">
              <Star className="w-3.5 h-3.5 text-emerald-400" strokeWidth={1.5} />
              Wins — What went well?
            </label>
            <textarea
              value={wins}
              onChange={(e) => setWins(e.target.value)}
              placeholder="List your wins for today..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/50 border border-white/[0.06] text-sm text-white placeholder:text-white/15 focus:border-gold-500/30 transition-all resize-none"
            />
          </GlowCard>

          {/* Mistakes */}
          <GlowCard>
            <label className="text-xs text-white/40 font-medium mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" strokeWidth={1.5} />
              Mistakes — What could be better?
            </label>
            <textarea
              value={mistakes}
              onChange={(e) => setMistakes(e.target.value)}
              placeholder="Be honest. Growth comes from awareness."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/50 border border-white/[0.06] text-sm text-white placeholder:text-white/15 focus:border-gold-500/30 transition-all resize-none"
            />
          </GlowCard>

          {/* Notes */}
          <GlowCard>
            <label className="text-xs text-white/40 font-medium mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-white/50" strokeWidth={1.5} />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any other thoughts, reflections, or observations..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/50 border border-white/[0.06] text-sm text-white placeholder:text-white/15 focus:border-gold-500/30 transition-all resize-none"
            />
          </GlowCard>

          {/* Tomorrow Focus */}
          <GlowCard glowColor="blue">
            <label className="text-xs text-white/40 font-medium mb-2 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5 text-blue-400" strokeWidth={1.5} />
              Tomorrow's Focus
            </label>
            <textarea
              value={tomorrowFocus}
              onChange={(e) => setTomorrowFocus(e.target.value)}
              placeholder="What is your #1 priority tomorrow?"
              rows={2}
              className="w-full px-3.5 py-2.5 rounded-xl bg-surface-200/50 border border-white/[0.06] text-sm text-white placeholder:text-white/15 focus:border-gold-500/30 transition-all resize-none"
            />
          </GlowCard>

          {/* AI Review Button */}
          <GlowCard>
            <button
              onClick={handleAiReview}
              disabled={aiLoading}
              className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-accent-purple/10 border border-accent-purple/20 text-accent-purple text-sm font-medium hover:bg-accent-purple/15 transition-all disabled:opacity-50"
            >
              {aiLoading ? (
                <><Brain className="w-4 h-4 animate-pulse" strokeWidth={1.5} /> Analyzing...</>
              ) : (
                <><Sparkles className="w-4 h-4" strokeWidth={1.5} /> Generate AI Review</>
              )}
            </button>
          </GlowCard>
        </div>

        {/* Right: AI Summary + Past Reviews */}
        <div className="space-y-4">
          {/* AI Summary */}
          {aiSummary && (
            <GlowCard glowColor="purple">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-purple-400" strokeWidth={1.5} />
                <h2 className="text-sm font-semibold">AI Review</h2>
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                  aiSummary.sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-400' :
                  aiSummary.sentiment === 'neutral' ? 'bg-gold-500/10 text-gold-400' :
                  'bg-rose-500/10 text-rose-400'
                }`}>
                  {aiSummary.sentiment}
                </span>
              </div>
              <p className="text-sm text-white/60 leading-relaxed">{aiSummary.summary}</p>
              {aiSummary.insights?.length > 0 && (
                <div className="mt-3 space-y-1">
                  {aiSummary.insights.map((insight, i) => (
                    <p key={i} className="text-xs text-white/40 flex items-center gap-1.5">
                      <Sparkles className="w-3 h-3 text-gold-400" strokeWidth={1.5} />
                      {insight}
                    </p>
                  ))}
                </div>
              )}
              <div className="mt-3 p-3 rounded-xl bg-accent-blue/5 border border-accent-blue/10">
                <p className="text-[10px] uppercase tracking-wider text-accent-blue/60 font-medium">Suggested Focus</p>
                <p className="text-sm text-white/60 mt-1">{aiSummary.suggestedFocus}</p>
              </div>
            </GlowCard>
          )}

          {/* Score Card */}
          <GlowCard>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-4 h-4 text-white/30" strokeWidth={1.5} />
              <h2 className="text-sm font-semibold">Today's Summary</h2>
            </div>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="p-3 rounded-xl bg-gold-500/8">
                <span className="text-[10px] uppercase tracking-wider text-white/30">Mood</span>
                <p className="text-2xl font-bold text-gold-400 mt-1">{mood}/10</p>
              </div>
              <div className="p-3 rounded-xl bg-gold-500/8">
                <span className="text-[10px] uppercase tracking-wider text-white/30">Energy</span>
                <p className="text-2xl font-bold text-gold-400 mt-1">{energy}/10</p>
              </div>
            </div>
            <div className="mt-3 p-3 rounded-xl bg-surface-200/50">
              <span className="text-[10px] uppercase tracking-wider text-white/30">Focus Tomorrow</span>
              <p className="text-sm text-white/60 mt-1">{tomorrowFocus || 'Not set yet'}</p>
            </div>
          </GlowCard>

          {/* Past Reviews */}
          <GlowCard>
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-white/30" strokeWidth={1.5} />
              <h2 className="text-sm font-semibold">Past Reviews</h2>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto scrollable pr-1">
              {pastReviews.length === 0 ? (
                <p className="text-sm text-white/30 italic">No previous reviews.</p>
              ) : (
                pastReviews.map((r) => (
                  <div key={r.id} className="p-3 rounded-xl bg-surface-200/40 border border-white/[0.03] hover:bg-surface-200/60 transition-all cursor-pointer"
                    onClick={() => {
                      setMood(r.mood);
                      setEnergy(r.energy);
                      setWins(r.wins || '');
                      setMistakes(r.mistakes || '');
                      setNotes(r.notes || '');
                      setTomorrowFocus(r.tomorrowFocus || '');
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-white/40 font-mono">{r.date}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gold-400">{r.mood}/10</span>
                        <span className="text-xs text-blue-400">{r.energy}/10</span>
                      </div>
                    </div>
                    <p className="text-xs text-white/50 line-clamp-1">{r.notes || r.wins || 'No notes'}</p>
                  </div>
                ))
              )}
            </div>
          </GlowCard>
        </div>
      </div>
    </div>
  );
}




