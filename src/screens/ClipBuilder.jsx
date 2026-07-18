import { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Youtube, Search, Wand2, Download, Edit3, Play, Brain,
  TrendingUp, Eye, Heart, Bookmark, Loader2, AlertCircle,
  CheckCircle2, Flame, ChevronRight, Volume2, Film, Trash2,
  Monitor, Smartphone, MessageSquare, Zap, Shield, Swords, Newspaper, Star,
} from 'lucide-react';

const BACKEND = 'http://localhost:8787';
const SFX_PACK = 'C:/Users/shahe/Desktop/clip-builder/sfx/football-sfx-pack-xFKK_M6gFdA.mp3';

// Tweet type metadata
const TWEET_TYPES = {
  SHUT_UP:      { icon: Shield,   label: 'Shut Up / Silence Haters',  color: 'text-red-400',   bg: 'bg-red-500/10',    desc: 'Tweet criticizes → footage proves them WRONG' },
  TWEET_POPUP:  { icon: MessageSquare, label: 'Tweet Popup Reaction', color: 'text-sky-400',  bg: 'bg-sky-500/10',    desc: 'Tweet claim → footage responds (lighter tone)' },
  TRADE:        { icon: Newspaper, label: 'Trade / Transfer Hype',   color: 'text-amber-400', bg: 'bg-amber-500/10',  desc: 'Transfer news → player highlights → club reveal' },
  MATCHUP:      { icon: Swords,   label: 'Matchup Debate',           color: 'text-violet-400', bg: 'bg-violet-500/10', desc: 'Two teams compared → who wins?' },
  HIGHLIGHT:    { icon: Star,     label: 'Highlight / Storytelling', color: 'text-emerald-400', bg: 'bg-emerald-500/10', desc: 'A moment happened → nostalgia edit' },
};

const STAGES = [
  { id: 'scan',      icon: Search,   label: 'Trend Scan',  sub: 'Twitter → ranked clips',         color: 'text-sky-400' },
  { id: 'analyze',   icon: Brain,   label: 'Analyze',     sub: 'AI reads tweet → finds type',     color: 'text-rose-400' },
  { id: 'find',      icon: Film,    label: 'Find Videos',  sub: 'Auto-search YouTube',            color: 'text-amber-400' },
  { id: 'blueprint', icon: Wand2,    label: 'Blueprint',   sub: '3 ideas → pick one',             color: 'text-violet-400' },
  { id: 'edit',      icon: Edit3,    label: 'Edit',        sub: '9:16 + tweet overlay + SFX',    color: 'text-rose-400' },
  { id: 'preview',   icon: Play,     label: 'Preview',     sub: 'Watch + download clip',           color: 'text-emerald-400' },
];

const PRESET_QUERIES_BY_NICHE = {
  football: ['football', 'Premier League', 'Champions League', 'World Cup', 'soccer skills', 'goal'],
  streaming: ['streamer clips', 'twitch viral', 'kick clips', 'streamer funny', 'streamer drama'],
  ufc: ['UFC clips', 'UFC knockout', 'UFC press conference', 'MMA highlights', 'UFC drama'],
  streamers_university: ['Streamers University', 'Kai Cenat university', 'streamer university clips', 'Streamer University 2025', 'streamer university funny'],
};

const NICHE_META = {
  football: { icon: '⚽', label: 'Football', color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
  streaming: { icon: '🎮', label: 'Streaming', color: 'text-violet-400', bg: 'bg-violet-500/10' },
  ufc: { icon: '🥊', label: 'UFC', color: 'text-red-400', bg: 'bg-red-500/10' },
  streamers_university: { icon: '🎓', label: 'Streamers Uni', color: 'text-amber-400', bg: 'bg-amber-500/10' },
};

function formatNum(n) {
  if (!n) return '0';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

export default function ClipBuilder() {
  const [stage, setStage] = useState('scan');
  const [niche, setNiche] = useState('football');
  const [query, setQuery] = useState('football');
  const [scanning, setScanning] = useState(false);
  const [tweets, setTweets] = useState([]);
  const [selectedTweet, setSelectedTweet] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [foundVideos, setFoundVideos] = useState([]);
  const [findingVideos, setFindingVideos] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [blueprint, setBlueprint] = useState(null);
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [selectedIdea, setSelectedIdea] = useState(null);
  const [downloadResult, setDownloadResult] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editResult, setEditResult] = useState(null);
  const [error, setError] = useState(null);
  const [clips, setClips] = useState([]);
  const [activeClip, setActiveClip] = useState(null);
  const [tweetImgPath, setTweetImgPath] = useState(null);

  useEffect(() => { loadClips(); }, []);
  const loadClips = useCallback(async () => {
    try {
      const r = await fetch(`${BACKEND}/api/clip/list`);
      const j = await r.json();
      if (j.ok) { setClips(j.clips || []); if (j.clips?.length > 0 && !activeClip) setActiveClip(j.clips[0]); }
    } catch {}
  }, [activeClip]);

  // --- Stage 1: Scan ---
  const scanTrends = useCallback(async () => {
    setScanning(true); setError(null); setTweets([]); setSelectedTweet(null); setAnalysis(null); setEditResult(null);
    try {
      const r = await fetch(`${BACKEND}/api/clip/scan?q=${encodeURIComponent(query)}&n=15`);
      const j = await r.json();
      if (!j.ok) setError(j.error || 'Scan failed');
      else setTweets(j.tweets || []);
    } catch (e) { setError(`Connection error: ${e.message}`); }
    finally { setScanning(false); }
  }, [query]);

  // --- Stage 2: Analyze Tweet (determine type) ---
  const analyzeTweet = useCallback(async (tweet) => {
    setSelectedTweet(tweet);
    setAnalyzing(true); setError(null); setAnalysis(null); setFoundVideos([]); setBlueprint(null); setSelectedIdea(null); setTweetImgPath(null);
    setStage('analyze');
    try {
      const r = await fetch(`${BACKEND}/api/clip/analyze`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweet, niche }),
      });
      const j = await r.json();
      if (!j.ok || !j.analysis) { setError(j.error || 'Analysis failed'); }
      else { setAnalysis(j.analysis); }
    } catch (e) { setError(`Analysis error: ${e.message}`); }
    finally { setAnalyzing(false); }
  }, []);

  // --- Stage 3: Find Videos ---
  const findVideos = useCallback(async () => {
    if (!analysis?.search_queries?.length) { setError('No search queries from analysis'); return; }
    setFindingVideos(true); setError(null); setFoundVideos([]); setSelectedVideo(null);
    setStage('find');
    try {
      // Build context for AI verification — the tweet text + analysis subject
      const context = [
        selectedTweet ? `Tweet: "${selectedTweet.text}"` : '',
        analysis.subject ? `Subject: ${analysis.subject}` : '',
        analysis.type ? `Clip type: ${analysis.type}` : '',
        analysis.edit_style ? `Edit style: ${analysis.edit_style}` : '',
      ].filter(Boolean).join('\n');
      // Determine recency mode from clip type — events/debates/trades = recent, highlights/nostalgia = any
      const typeStr = (analysis.type || '').toUpperCase();
      const isNostalgia = typeStr.includes('HIGHLIGHT') || typeStr.includes('STORYTELLING') || typeStr.includes('NOSTALGIA');
      const recency = isNostalgia ? 'any' : 'recent';
      const r = await fetch(`${BACKEND}/api/clip/find-videos`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queries: analysis.search_queries, context, recency }),
      });
      const j = await r.json();
      if (!j.ok) setError(j.error || 'Video search failed');
      else setFoundVideos(j.videos || []);
    } catch (e) { setError(`Search error: ${e.message}`); }
    finally { setFindingVideos(false); }
  }, [analysis, selectedTweet]);

  // --- Stage 4: Blueprint ---
  const generateBlueprint = useCallback(async () => {
    if (!selectedTweet) return;
    setBlueprintLoading(true); setError(null); setBlueprint(null); setSelectedIdea(null);
    setStage('blueprint');
    try {
      const r = await fetch(`${BACKEND}/api/clip/blueprint`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tweet: selectedTweet }),
      });
      const j = await r.json();
      if (!j.ok || !j.ideas || j.ideas.length === 0) {
        setError(j.error || 'Blueprint failed — no ideas returned');
      } else {
        setBlueprint(j.ideas);
      }
    } catch (e) { setError(`Blueprint error: ${e.message}`); }
    finally { setBlueprintLoading(false); }
  }, [selectedTweet]);

  // --- Stage 5: Download + Edit ---
  const downloadAndEdit = useCallback(async () => {
    const url = selectedVideo?.url || selectedTweet?.videoUrl || selectedTweet?.url;
    if (!url) { setError('No video URL to download'); return; }
    setDownloading(true); setError(null);
    try {
      const r = await fetch(`${BACKEND}/api/clip/download`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const j = await r.json();
      setDownloadResult(j);
      if (j.ok && j.filename) {
        setStage('edit');
        // Auto-generate tweet popup image if needed
        if (analysis?.tweet_popup && analysis?.popup_text) {
          try {
            const imgResp = await fetch(`${BACKEND}/api/clip/tweet-image`, {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: selectedTweet?.screenName || 'User',
                handle: '@' + (selectedTweet?.screenName || 'user'),
                text: analysis.popup_text,
                metrics: `💬 ${formatNum(selectedTweet?.replies)} 🔁 ${formatNum(selectedTweet?.retweets)} ❤️ ${formatNum(selectedTweet?.likes)}`,
                format_type: (analysis?.type === 'SHUT_UP' || analysis?.type === 'DRAMA') ? 'shut_up' : 'popup',
              }),
            });
            const imgJson = await imgResp.json();
            if (imgJson.ok) setTweetImgPath(imgJson.path);
          } catch {}
        }
      } else {
        setError(j.error || 'Download failed');
      }
    } catch (e) { setError(`Download error: ${e.message}`); }
    finally { setDownloading(false); }
  }, [selectedVideo, selectedTweet, analysis]);

  const runEdit = useCallback(async () => {
    const inputFile = downloadResult?.filename;
    if (!inputFile) return;
    setEditing(true); setError(null);
    try {
      const idea = selectedIdea || {};
      const formatConfig = analysis?.format_config || {};
      const spec = {
        start: idea.start || analysis?.start || '00:00:05',
        duration: idea.duration || analysis?.duration || 30,
        hook_text: idea.hook_text || analysis?.hook_text || '',
        subtitle_text: idea.subtitle_text || analysis?.subtitle_text || idea.hook_caption || '',
        format_type: analysis?.type || 'HIGHLIGHT',
        overlay_texts: formatConfig.overlay_texts || [],
        formula: idea.formula || analysis?.type || '',
      };
      const r = await fetch(`${BACKEND}/api/clip/edit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: inputFile, spec, sfx: SFX_PACK, tweet_img: tweetImgPath }),
      });
      const j = await r.json();
      setEditResult(j);
      if (j.ok) {
        await loadClips();
        const r2 = await fetch(`${BACKEND}/api/clip/list`);
        const j2 = await r2.json();
        if (j2.ok && j2.clips?.length > 0) setActiveClip(j2.clips[0]);
        setStage('preview');
      }
    } catch (e) { setError(`Edit error: ${e.message}`); }
    finally { setEditing(false); }
  }, [downloadResult, selectedIdea, analysis, tweetImgPath, loadClips]);

  const deleteClip = useCallback(async (filename) => {
    try {
      await fetch(`${BACKEND}/api/clip/delete`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename }),
      });
      await loadClips();
      if (activeClip?.filename === filename) setActiveClip(clips[0] || null);
    } catch {}
  }, [activeClip, clips, loadClips]);

  const currentStageIndex = STAGES.findIndex((s) => s.id === stage);
  const ideas = Array.isArray(blueprint) ? blueprint : [];
  const tweetTypeMeta = analysis?.type ? TWEET_TYPES[analysis.type] : null;

  return (
    <div className="min-h-screen pb-12">
      {/* Header */}
      <div className="px-6 lg:px-8 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500/20 to-amber-500/20 flex items-center justify-center border border-rose-500/20">
            <Youtube className="w-5 h-5 text-rose-400" strokeWidth={1.5} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white/90">Clip Builder</h1>
            <p className="text-xs text-white/40">AI-powered: reads tweet → finds type → finds footage → edits</p>
          </div>
        </div>
      </div>

      {/* Pipeline progress */}
      <div className="px-6 lg:px-8 mb-6">
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-3">
          <div className="flex items-center gap-1 overflow-x-auto">
            {STAGES.map((s, i) => {
              const Icon = s.icon;
              const isActive = stage === s.id;
              const isDone = currentStageIndex > i;
              return (
                <div key={s.id} className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setStage(s.id)} className={`flex items-center gap-2 px-3 py-2 rounded-xl border transition-all ${isActive ? 'bg-gold-500/10 border-gold-500/20' : isDone ? 'bg-emerald-500/[0.04] border-emerald-500/10' : 'bg-white/[0.02] border-white/[0.04] opacity-50'}`}>
                    <Icon className={`w-4 h-4 ${isActive ? 'text-gold-400' : isDone ? 'text-emerald-400' : s.color}`} strokeWidth={1.5} />
                    <span className={`text-xs font-medium ${isActive ? 'text-gold-400' : isDone ? 'text-emerald-400' : 'text-white/50'}`}>{s.label}</span>
                  </button>
                  {i < STAGES.length - 1 && <ChevronRight className="w-3 h-3 text-white/15" />}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="px-6 lg:px-8 mb-4">
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-500/10 border border-rose-500/15 text-sm text-rose-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /><span>{error}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {/* === STAGE 1: SCAN === */}
        {stage === 'scan' && (
          <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 lg:px-8">
            {/* Niche selector */}
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 mb-4">
              <p className="text-xs text-white/40 mb-3">Select your niche — each has its own clip formats and search sources</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(NICHE_META).map(([key, meta]) => (
                  <button key={key} onClick={() => { setNiche(key); setQuery(PRESET_QUERIES_BY_NICHE[key][0]); }} className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border transition-all ${niche === key ? meta.bg + ' border-white/20' : 'bg-white/[0.02] border-white/[0.04] hover:border-white/0.1'}`}>
                    <span className="text-xl">{meta.icon}</span>
                    <span className={`text-sm font-medium ${niche === key ? meta.color : 'text-white/50'}`}>{meta.label}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-4 h-4 text-sky-400" /><h2 className="text-sm font-semibold text-white/80">Scan Twitter for Trending Clips</h2>
              </div>
              <div className="flex gap-2 mb-3">
                <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && scanTrends()} placeholder="Search query..." className="flex-1 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm text-white/80 placeholder-white/30 focus:outline-none focus:border-gold-500/30" />
                <button onClick={scanTrends} disabled={scanning || !query} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border border-sky-500/20 disabled:opacity-40 text-sm font-medium transition-all">
                  {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}{scanning ? 'Scanning...' : 'Scan'}
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] text-white/30">Quick:</span>
                {PRESET_QUERIES_BY_NICHE[niche].map((q) => <button key={q} onClick={() => setQuery(q)} className="text-[11px] px-2 py-1 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-white/40 hover:text-white/60 transition-colors">{q}</button>)}
              </div>
            </div>
            {tweets.length > 0 && (
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4">
                <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-white/40" /><p className="text-sm font-medium text-white/70">{tweets.length} clips — click one to analyze</p></div>
                <div className="space-y-2 max-h-[450px] overflow-y-auto">
                  {tweets.map((t, i) => (
                    <motion.div key={t.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }} onClick={() => analyzeTweet(t)} className="flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.1]">
                      <div className="flex flex-col items-center gap-1 pt-1"><span className="text-lg font-bold text-gold-400/60 font-mono">#{i + 1}</span><span className={`text-[9px] px-1 py-0.5 rounded font-mono ${t.official ? 'bg-white/10 text-white/30' : 'bg-emerald-500/10 text-emerald-400'}`}>{t.official ? 'OFFICIAL' : 'VIRAL'}</span></div>
                      <div className="flex-1 min-w-0"><p className="text-sm text-white/80 mb-1">{t.text}</p>
                        <div className="flex items-center gap-3 text-[11px] text-white/40">
                          <span className="font-mono text-white/50">@{t.screenName}</span>
                          <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatNum(t.views)}</span>
                          <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {formatNum(t.likes)}</span>
                          <span className="text-amber-400/60">{t.likeRate}% like</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20 flex-shrink-0" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* === STAGE 2: ANALYZE === */}
        {stage === 'analyze' && (
          <motion.div key="analyze" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 lg:px-8">
            {selectedTweet && (
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 mb-4">
                <div className="flex items-center gap-2 mb-2"><Flame className="w-4 h-4 text-amber-400" /><span className="text-sm font-medium text-white/70">Selected tweet</span></div>
                <p className="text-sm text-white/80 mb-2">{selectedTweet.text}</p>
                <div className="flex items-center gap-3 text-[11px] text-white/40">
                  <span className="font-mono text-white/50">@{selectedTweet.screenName}</span>
                  <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatNum(selectedTweet.views)}</span>
                  <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {formatNum(selectedTweet.likes)}</span>
                </div>
              </div>
            )}

            {analyzing ? (
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-rose-400 mx-auto mb-3" />
                <p className="text-sm text-white/60">AI analyzing tweet...</p>
                <p className="text-xs text-white/30 mt-1">Determining clip type, subject, and footage to find</p>
              </div>
            ) : analysis ? (
              <div className="space-y-4">
                {/* Tweet Type Card */}
                {tweetTypeMeta && (
                  <div className={`rounded-2xl border p-4 ${tweetTypeMeta.bg} border-white/[0.05]`}>
                    <div className="flex items-center gap-3 mb-2">
                      {(() => { const Icon = tweetTypeMeta.icon; return <Icon className={`w-6 h-6 ${tweetTypeMeta.color}`} />; })()}
                      <div>
                        <p className={`text-sm font-bold ${tweetTypeMeta.color}`}>{analysis.type}</p>
                        <p className="text-xs text-white/50">{tweetTypeMeta.desc}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Analysis Details */}
                <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 space-y-3">
                  {analysis.subject && (
                    <div><p className="text-[11px] text-white/30 mb-1">SUBJECT (what the clip should feature)</p><p className="text-sm text-white/80">{analysis.subject}</p></div>
                  )}
                  {analysis.search_queries?.length > 0 && (
                    <div>
                      <p className="text-[11px] text-white/30 mb-1">SEARCH QUERIES (to find source footage)</p>
                      <div className="flex flex-wrap gap-2">{analysis.search_queries.map((q, i) => <span key={i} className="text-xs px-2 py-1 rounded-lg bg-amber-500/10 text-amber-400 font-mono">{q}</span>)}</div>
                    </div>
                  )}
                  {analysis.hook_text && (
                    <div><p className="text-[11px] text-white/30 mb-1">HOOK TEXT (first 3 seconds)</p><p className="text-sm text-white/80 font-semibold">{analysis.hook_text}</p></div>
                  )}
                  {analysis.subtitle_text && (
                    <div><p className="text-[11px] text-white/30 mb-1">SUBTITLE TEXT (burned into video)</p><p className="text-sm text-white/60">{analysis.subtitle_text}</p></div>
                  )}
                  {analysis.edit_style && (
                    <div><p className="text-[11px] text-white/30 mb-1">EDIT STYLE</p><p className="text-sm text-white/60">{analysis.edit_style}</p></div>
                  )}
                </div>

                <button onClick={findVideos} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20 text-sm font-medium transition-all">
                  <Film className="w-4 h-4" /> Find Source Videos <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              !error && <div className="text-center py-8 text-white/30 text-sm">Waiting for analysis...</div>
            )}
          </motion.div>
        )}

        {/* === STAGE 3: FIND VIDEOS === */}
        {stage === 'find' && (
          <motion.div key="find" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 lg:px-8">
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4 mb-4">
              <div className="flex items-center gap-2 mb-2"><Film className="w-4 h-4 text-amber-400" /><h2 className="text-sm font-semibold text-white/80">Auto-Found Source Videos</h2></div>
              <p className="text-xs text-white/40 mb-3">Searched YouTube using: {analysis?.search_queries?.join(', ')}</p>
              {selectedTweet?.videoUrl && (
                <div className="p-3 rounded-xl bg-sky-500/[0.04] border border-sky-500/10 mb-3">
                  <p className="text-xs text-sky-400 mb-1">📌 This tweet has its own video — you can use it directly</p>
                  <p className="text-[11px] text-white/40 font-mono truncate">{selectedTweet.videoUrl}</p>
                </div>
              )}
            </div>

            {findingVideos ? (
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-8 text-center">
                <Loader2 className="w-8 h-8 animate-spin text-amber-400 mx-auto mb-3" />
                <p className="text-sm text-white/60">Searching YouTube for source footage...</p>
              </div>
            ) : foundVideos.length > 0 ? (
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4">
                <div className="flex items-center gap-2 mb-3"><TrendingUp className="w-4 h-4 text-white/40" /><p className="text-sm font-medium text-white/70">{foundVideos.length} videos found — AI-ranked by relevance &amp; recency</p></div>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {foundVideos.map((v, i) => (
                    <motion.div key={v.video_id + i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }} onClick={() => setSelectedVideo(v)} className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedVideo?.video_id === v.video_id ? 'bg-gold-500/10 border-gold-500/25' : 'bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04]'}`}>
                      <div className="flex flex-col items-center gap-1 pt-1"><span className="text-sm font-bold text-gold-400/60 font-mono">#{i + 1}</span></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-white/80 mb-1 line-clamp-2">{v.title}</p>
                        <div className="flex items-center gap-2 flex-wrap text-[11px] text-white/40">
                          <span className="font-mono text-white/50">{v.uploader}</span>
                          {v.views !== '?' && <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {formatNum(parseInt(v.views))}</span>}
                          {v.duration !== '?' && <span>⏱ {v.duration}s</span>}
                          {v.age_label && v.age_label !== '?' && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${v.days_old !== null && v.days_old < 30 ? 'bg-emerald-500/15 text-emerald-400' : v.days_old !== null && v.days_old < 365 ? 'bg-amber-500/15 text-amber-400' : 'bg-white/5 text-white/40'}`}>{v.age_label}</span>
                          )}
                          {v.search_type === 'recency' && <span className="text-sky-400/50">newest</span>}
                          {v.ai_score != null && (
                            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${v.ai_score >= 75 ? 'bg-emerald-500/15 text-emerald-400' : v.ai_score >= 50 ? 'bg-amber-500/15 text-amber-400' : 'bg-white/5 text-white/40'}`}>AI {v.ai_score}</span>
                          )}
                        </div>
                        {v.ai_reason && <p className="text-[10px] text-white/30 mt-1 italic">{v.ai_reason}</p>}
                      </div>
                      {selectedVideo?.video_id === v.video_id && <CheckCircle2 className="w-4 h-4 text-gold-400 flex-shrink-0" />}
                    </motion.div>
                  ))}
                </div>
                {selectedVideo && (
                  <button onClick={generateBlueprint} className="mt-3 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border border-violet-500/20 text-sm font-medium transition-all">
                    <Wand2 className="w-4 h-4" /> Generate Blueprint <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-white/30 text-sm">No videos found. Try a different search.</div>
            )}
          </motion.div>
        )}

        {/* === STAGE 4: BLUEPRINT === */}
        {stage === 'blueprint' && (
          <motion.div key="blueprint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-4">
              <button onClick={generateBlueprint} disabled={blueprintLoading} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-500/15 text-violet-400 hover:bg-violet-500/25 border border-violet-500/20 disabled:opacity-40 text-sm font-medium transition-all">
                {blueprintLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {blueprintLoading ? 'GLM 5.2 generating...' : 'Generate 3 Clip Ideas'}
              </button>
              {selectedVideo && <span className="text-xs text-white/40">Footage: {selectedVideo.title?.slice(0, 40)}...</span>}
            </div>

            {ideas.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {ideas.map((idea, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} onClick={() => setSelectedIdea(idea)} className={`rounded-2xl border p-4 cursor-pointer transition-all ${selectedIdea === idea ? 'bg-gold-500/10 border-gold-500/30' : 'bg-white/[0.02] border-white/[0.05] hover:border-white/[0.1]'}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${i === 0 ? 'bg-sky-500/10 text-sky-400' : i === 1 ? 'bg-violet-500/10 text-violet-400' : 'bg-rose-500/10 text-rose-400'}`}>{idea.formula || `Formula ${i + 1}`}</span>
                      {selectedIdea === idea && <CheckCircle2 className="w-4 h-4 text-gold-400" />}
                    </div>
                    <p className="text-sm font-semibold text-white/90 mb-2 leading-snug">{idea.hook_caption || `Idea ${i + 1}`}</p>
                    {idea.subtitle_text && <p className="text-[11px] text-amber-400/40 mb-2 italic">subtitle: {idea.subtitle_text}</p>}
                    {idea.narration && <p className="text-xs text-white/50 mb-3 leading-relaxed">{idea.narration}</p>}
                    <div className="space-y-1.5 text-[11px] text-white/40">
                      {idea.sfx_plan && <p className="flex items-start gap-1"><Volume2 className="w-3 h-3 mt-0.5 flex-shrink-0" /><span>{idea.sfx_plan}</span></p>}
                      {idea.edit_notes && <p className="flex items-start gap-1"><Edit3 className="w-3 h-3 mt-0.5 flex-shrink-0 text-rose-400/50" /><span>{idea.edit_notes}</span></p>}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {selectedIdea && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-4 flex items-center gap-3">
                <button onClick={downloadAndEdit} disabled={downloading} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gold-500/15 text-gold-400 hover:bg-gold-500/25 border border-gold-500/20 disabled:opacity-40 text-sm font-medium transition-all">
                  {downloading ? <><Loader2 className="w-4 h-4 animate-spin" /> Downloading...</> : <><Download className="w-4 h-4" /> Download & Edit</>}
                </button>
                <span className="text-xs text-white/40">Will download source video and run the edit pipeline</span>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* === STAGE 5: EDIT === */}
        {stage === 'edit' && (
          <motion.div key="edit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 lg:px-8">
            <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-5 mb-4">
              <div className="flex items-center gap-2 mb-4">
                <Edit3 className="w-4 h-4 text-rose-400" /><h2 className="text-sm font-semibold text-white/80">Edit Pipeline — {analysis?.type || 'Highlight'} Format</h2>
              </div>

              {/* Show what's being applied */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
                {[
                  { label: '9:16 Vertical', icon: Smartphone, color: 'text-sky-400' },
                  { label: 'Subtitles', icon: Edit3, color: 'text-violet-400' },
                  { label: 'SFX + Audio', icon: Volume2, color: 'text-amber-400' },
                  { label: 'Color Grade', icon: Star, color: 'text-rose-400' },
                  { label: analysis?.tweet_popup ? 'Tweet Popup' : 'Hook Text', icon: MessageSquare, color: 'text-emerald-400' },
                  { label: '1080×1920 HD', icon: Monitor, color: 'text-white/40' },
                ].map((item, i) => {
                  const Icon = item.icon;
                  return <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"><Icon className={`w-3.5 h-3.5 ${item.color}`} /><span className="text-[11px] text-white/50">{item.label}</span></div>;
                })}
              </div>

              {analysis?.hook_text && (
                <div className="mb-3 p-3 rounded-xl bg-rose-500/[0.04] border border-rose-500/10">
                  <p className="text-[11px] text-rose-400 mb-1">HOOK (first 3s)</p>
                  <p className="text-sm text-white/80 font-semibold">{analysis.hook_text}</p>
                </div>
              )}
              {analysis?.tweet_popup && analysis?.popup_text && (
                <div className="mb-3 p-3 rounded-xl bg-sky-500/[0.04] border border-sky-500/10">
                  <p className="text-[11px] text-sky-400 mb-1">TWEET POPUP OVERLAY</p>
                  <p className="text-sm text-white/80">"{analysis.popup_text}"</p>
                  <p className="text-[11px] text-white/40 mt-1">Tweet card will be burned onto the video for the first 3 seconds</p>
                </div>
              )}
              {downloadResult?.filename && (
                <div className="mb-3 p-2 rounded-lg bg-emerald-500/[0.04] border border-emerald-500/10">
                  <p className="text-[11px] text-emerald-400">Source video downloaded: {downloadResult.size ? `${(downloadResult.size/1024/1024).toFixed(1)} MB` : 'OK'}</p>
                </div>
              )}

              <button onClick={runEdit} disabled={editing} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20 disabled:opacity-40 text-sm font-medium transition-all">
                {editing ? <><Loader2 className="w-4 h-4 animate-spin" /> Editing (60-90s)...</> : <><Zap className="w-4 h-4" /> Run Edit Pipeline</>}
              </button>
            </div>

            {editResult && !editResult.ok && (
              <div className="rounded-2xl bg-rose-500/10 border border-rose-500/15 p-4">
                <div className="flex items-center gap-2 mb-2"><AlertCircle className="w-4 h-4 text-rose-400" /><span className="text-sm text-rose-300">Edit failed</span></div>
                <pre className="text-xs text-white/40 whitespace-pre-wrap max-h-32 overflow-y-auto">{editResult.stderr || editResult.error || 'Unknown error'}</pre>
              </div>
            )}
          </motion.div>
        )}

        {/* === STAGE 6: PREVIEW === */}
        {stage === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-4">
              {/* Video player */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Play className="w-4 h-4 text-emerald-400" /><h2 className="text-sm font-semibold text-white/80">Preview</h2>
                </div>
                {activeClip ? (
                  <>
                    <div className="relative rounded-xl overflow-hidden bg-black mb-3" style={{ aspectRatio: '9/16', maxHeight: '600px' }}>
                      <video
                        key={activeClip.filename}
                        src={`${BACKEND}${activeClip.preview_url}`}
                        poster={activeClip.thumb_url ? `${BACKEND}${activeClip.thumb_url}` : undefined}
                        controls
                        playsInline
                        preload="metadata"
                        className="w-full h-full object-contain"
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-3">
                      <a href={`${BACKEND}${activeClip.download_url}`} download className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20 text-sm font-medium transition-all flex-1 justify-center">
                        <Download className="w-4 h-4" /> Download MP4
                      </a>
                      <button onClick={() => deleteClip(activeClip.filename)} className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/15 text-sm transition-all">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="text-xs text-white/40 space-y-1">
                      <p className="font-mono text-white/50 break-all">{activeClip.filename}</p>
                      <p>{(activeClip.size / 1024 / 1024).toFixed(1)} MB</p>
                      <p className="text-emerald-400/50">Ready for: YouTube Shorts, Instagram Reels, TikTok</p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-white/30 text-sm">No clips yet. Build one from the pipeline above.</div>
                )}
              </div>

              {/* Clip library */}
              <div className="rounded-2xl bg-white/[0.02] border border-white/[0.05] p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Film className="w-4 h-4 text-white/40" /><h2 className="text-sm font-semibold text-white/80">Clip Library</h2>
                  <span className="text-xs text-white/30">({clips.length})</span>
                  <button onClick={loadClips} className="ml-auto text-xs text-white/40 hover:text-white/60">↻ Refresh</button>
                </div>
                {clips.length === 0 ? (
                  <div className="text-center py-12 text-white/30 text-sm">No clips in library</div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-[600px] overflow-y-auto">
                    {clips.map((clip) => (
                      <div key={clip.filename} onClick={() => setActiveClip(clip)} className={`rounded-xl border p-2 cursor-pointer transition-all ${activeClip?.filename === clip.filename ? 'bg-gold-500/10 border-gold-500/25' : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'}`}>
                        <div className="rounded-lg bg-black/40 mb-2 overflow-hidden relative" style={{ aspectRatio: '9/16' }}>
                          {clip.thumb_url ? (
                            <img src={`${BACKEND}${clip.thumb_url}`} alt="" loading="lazy" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Play className="w-6 h-6 text-white/30" /></div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        </div>
                        <p className="text-[10px] text-white/60 font-mono truncate">{clip.filename}</p>
                        <p className="text-[10px] text-white/30">{(clip.size / 1024 / 1024).toFixed(1)} MB</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="mt-4 p-3 rounded-xl bg-white/[0.02] border border-white/[0.04]">
                  <p className="text-xs text-white/40 mb-2">📁 Clips are saved at:</p>
                  <p className="text-[11px] text-white/30 font-mono break-all">C:\Users\shahe\Desktop\clip-builder\clips\</p>
                </div>
              </div>
            </div>

            <button onClick={() => { setStage('scan'); setSelectedTweet(null); setAnalysis(null); setBlueprint(null); setSelectedIdea(null); setEditResult(null); setFoundVideos([]); }} className="mt-4 flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500/15 text-sky-400 hover:bg-sky-500/25 border border-sky-500/20 text-sm font-medium transition-all">
              <Search className="w-4 h-4" /> Build New Clip
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
