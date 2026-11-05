import React, { useState, useMemo } from 'react';
import { useArena } from '../context/ArenaContext';
import { Question, QuestionTier } from '../types/database';
import { ForgeQuestionModal } from '../components/ForgeQuestionModal';
import { playSound } from '../lib/audio';
import { parseQuestionTestCases } from '../lib/testcases';
import confetti from 'canvas-confetti';

export const QuestionsView: React.FC = () => {
  const { questions, injectBonusQuestion, isLoading } = useArena();
  const [filterStage, setFilterStage] = useState<'all' | 'live' | 'locked' | 'bonus'>('all');
  const [filterTier, setFilterTier] = useState<QuestionTier | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isForgeModalOpen, setIsForgeModalOpen] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (filterStage === 'live' && q.status !== 'live') return false;
      if (filterStage === 'locked' && q.status !== 'locked') return false;
      if (filterStage === 'bonus' && !q.is_bonus) return false;
      if (filterTier !== 'ALL' && q.tier !== filterTier) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        return q.title.toLowerCase().includes(query) || q.description.toLowerCase().includes(query);
      }
      return true;
    });
  }, [questions, filterStage, filterTier, searchQuery]);

  const liveCount = useMemo(() => questions.filter(q => q.status === 'live').length, [questions]);
  const lockedCount = useMemo(() => questions.filter(q => q.status === 'locked').length, [questions]);
  const bonusCount = useMemo(() => questions.filter(q => q.is_bonus).length, [questions]);
  const totalMaxPoints = useMemo(() => questions.reduce((sum, q) => sum + q.max_points, 0), [questions]);

  // Selected question for side preview
  const activeSelected = useMemo(() => {
    if (selectedQuestionId) {
      const found = questions.find(q => q.id === selectedQuestionId);
      if (found) return found;
    }
    return filteredQuestions[0] || questions[0] || null;
  }, [questions, filteredQuestions, selectedQuestionId]);

  const handleInject = async (qId: string) => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 }
    });
    await injectBonusQuestion(qId);
  };

  return (
    <div className="flex flex-col w-full p-gutter gap-space-lg text-on-surface">
      {/* Top Banner */}
      <div className="bg-surface-container-lowest p-space-md shadow-[4px_4px_0px_#000000] flex flex-col lg:flex-row lg:items-center justify-between gap-space-md border border-black">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-space-xs">
            <span className="inline-block w-3 h-3 bg-primary-container shadow-[1px_1px_0px_#000000]"></span>
            <h1 className="font-['Press_Start_2P'] text-[16px] text-primary-container uppercase tracking-wider">
              QUESTION BANK &amp; CHALLENGE REPOSITORY
            </h1>
          </div>
          <div className="font-['VT323'] text-[20px] text-on-surface-variant flex flex-wrap items-center gap-x-space-md gap-y-1">
            <span className="text-primary">
              TOTAL QUESTIONS: <strong className="text-tertiary-fixed">{questions.length}</strong>
            </span>
            <span className="text-outline">/</span>
            <span className="text-primary">
              ACTIVE NOW: <strong className="text-primary-container">{liveCount} LIVE</strong>
            </span>
            <span className="text-outline">/</span>
            <span className="text-primary">
              LOCKED IN QUEUE: <strong className="text-secondary">{lockedCount}</strong>
            </span>
            <span className="text-outline">/</span>
            <span className="text-tertiary-fixed">
              TOTAL POINTS: <strong className="text-primary">{totalMaxPoints} PTS</strong>
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="flex items-center gap-space-sm">
          <button 
            onClick={() => {
              playSound.click();
              setIsForgeModalOpen(true);
            }}
            className="bg-primary-container text-black font-['Press_Start_2P'] text-[11px] px-space-md py-space-sm shadow-[4px_4px_0px_#000000] hover:bg-tertiary-fixed active:translate-x-1 active:translate-y-1 transition-none flex items-center gap-2 font-bold"
          >
            <span className="material-symbols-outlined text-[16px]">add_box</span>
            <span>+ New Question</span>
          </button>
        </div>
      </div>

      {/* Filter Chips & Search */}
      <div className="bg-surface-container-low p-space-md shadow-[4px_4px_0px_#000000] flex flex-col gap-space-md border border-black">
        <div className="flex flex-wrap items-center justify-between gap-space-sm">
          <div className="flex flex-wrap items-center gap-space-xs font-['Press_Start_2P'] text-[10px]">
            <button 
              onClick={() => setFilterStage('all')}
              className={`px-space-sm py-1.5 border border-black shadow-[2px_2px_0px_#000000] ${
                filterStage === 'all' ? 'bg-primary-container text-black font-bold' : 'bg-surface-container-highest text-on-surface'
              }`}
            >
              ALL QUESTS ({questions.length})
            </button>
            <button 
              onClick={() => setFilterStage('live')}
              className={`px-space-sm py-1.5 border border-black shadow-[2px_2px_0px_#000000] flex items-center gap-1.5 ${
                filterStage === 'live' ? 'bg-tertiary-fixed text-black font-bold' : 'bg-surface-container-highest text-tertiary-fixed'
              }`}
            >
              <span className="w-2 h-2 bg-tertiary-fixed inline-block blink-fast"></span>
              LIVE NOW ({liveCount})
            </button>
            <button 
              onClick={() => setFilterStage('locked')}
              className={`px-space-sm py-1.5 border border-black shadow-[2px_2px_0px_#000000] flex items-center gap-1.5 ${
                filterStage === 'locked' ? 'bg-secondary text-black font-bold' : 'bg-surface-container-highest text-on-surface-variant'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">lock</span>
              LOCKED ({lockedCount})
            </button>
            <button 
              onClick={() => setFilterStage('bonus')}
              className={`px-space-sm py-1.5 border border-black shadow-[2px_2px_0px_#000000] flex items-center gap-1.5 ${
                filterStage === 'bonus' ? 'bg-secondary-container text-white font-bold' : 'bg-surface-container-highest text-secondary'
              }`}
            >
              <span className="material-symbols-outlined text-[12px]">star</span>
              BONUS ({bonusCount})
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative bg-surface-container-lowest shadow-[3px_3px_0px_#000000] flex items-center px-space-sm py-1 border border-black">
          <span className="font-['VT323'] text-tertiary-fixed text-[20px] select-none mr-2">&gt; QUERY</span>
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="FILTER BY TITLE, CATEGORY, OR DESCRIPTION..."
            className="w-full bg-transparent text-primary font-['Courier_Prime'] text-[14px] focus:outline-none placeholder:text-outline uppercase"
          />
        </div>
      </div>

      {/* Main Grid: Questions List (8 cols) + Question Inspector (4 cols) */}
      <div className="grid grid-cols-12 gap-space-lg">
        {/* Left Column: Questions List */}
        <div className="col-span-12 xl:col-span-8 flex flex-col gap-space-md">
          {isLoading ? (
            <div className="bg-surface-container-lowest p-space-xl border-[4px] border-black shadow-[6px_6px_0px_#000000] flex flex-col items-center justify-center text-center gap-space-md my-space-lg animate-pulse">
              <span className="text-[40px]">⏳</span>
              <span className="font-['Press_Start_2P'] text-[12px] text-primary-container">
                SYNCING QUESTION BANK...
              </span>
              <p className="font-['Courier_Prime'] text-[14px] text-on-surface-variant">
                Fetching latest contest prompts from Supabase
              </p>
            </div>
          ) : filteredQuestions.length === 0 ? (
            <div className="bg-surface-container-lowest p-space-xl border-[4px] border-black shadow-[6px_6px_0px_#000000] flex flex-col items-center justify-center text-center gap-space-md my-space-lg">
              <span className="text-[48px]">❓</span>
              <span className="font-['Press_Start_2P'] text-[14px] text-primary-container">
                NO QUESTIONS FOUND
              </span>
              <p className="font-['Courier_Prime'] text-[15px] text-on-surface-variant max-w-md">
                {questions.length === 0 
                  ? 'The question bank is empty. Click "+ Forge Question" to add your first contest prompt challenge.'
                  : 'No questions match your current filter search.'}
              </p>
            </div>
          ) : (
            filteredQuestions.map((q) => {
              const isSelected = activeSelected?.id === q.id;

              return (
                <div 
                  key={q.id}
                  onClick={() => setSelectedQuestionId(q.id)}
                  className={`cursor-pointer transition-none flex flex-col border-[3px] border-black shadow-[4px_4px_0px_#000000] ${
                    isSelected ? 'ring-2 ring-primary-container' : ''
                  } ${q.status === 'live' ? 'bg-surface-container' : 'bg-surface-container-low opacity-90'}`}
                >
                  {/* Card Header Bar */}
                  <div className="bg-surface-container-lowest px-space-md py-space-xs flex items-center justify-between border-b-[2px] border-black">
                    <div className="flex items-center gap-space-sm font-['Press_Start_2P'] text-[10px]">
                      <span className="px-1.5 py-0.5 bg-primary-container text-black font-bold text-[9px] shadow-[2px_2px_0px_#000000]">
                        #{q.order_index}
                      </span>
                      <span className="text-primary font-bold tracking-wide">
                        {q.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 font-['Press_Start_2P'] text-[8px] border border-black shadow-[2px_2px_0px_#000000] ${
                        q.status === 'live' 
                          ? 'bg-tertiary-fixed text-black font-bold' 
                          : 'bg-surface-container-highest text-outline'
                      }`}>
                        {q.status === 'live' ? '● LIVE' : '○ LOCKED'}
                      </span>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-space-md flex flex-col gap-space-sm">
                    <div className="flex flex-wrap items-center justify-between gap-space-xs">
                      <div className="flex items-center gap-space-xs flex-wrap">
                        <span className="px-space-xs py-0.5 bg-secondary-container text-white font-['Press_Start_2P'] text-[8px]">
                          {q.tier} :: {q.max_points} PTS
                        </span>
                        <span className="px-space-xs py-0.5 bg-surface-container-highest text-primary-container font-['VT323'] text-[16px]">
                          {q.category}
                        </span>
                        {q.is_bonus && (
                          <span className="px-space-xs py-0.5 bg-secondary text-black font-['Press_Start_2P'] text-[8px] font-bold">
                            ★ BONUS GAUNTLET
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="font-['Courier_Prime'] text-[14px] text-on-surface bg-surface-container-lowest p-space-sm shadow-[inset_2px_2px_0px_#000000] border border-black/40">
                      {q.description}
                    </p>

                    <div className="flex items-center justify-between pt-space-xs">
                      <span className="font-['VT323'] text-[16px] text-on-surface-variant">
                        SAMPLE INPUT: <code className="text-tertiary-fixed">{q.input_data.slice(0, 50)}{q.input_data.length > 50 ? '...' : ''}</code>
                      </span>

                      {q.status === 'locked' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInject(q.id);
                          }}
                          className="px-space-sm py-1 bg-secondary-container text-white font-['Press_Start_2P'] text-[8px] uppercase shadow-[2px_2px_0px_#000000] hover:bg-secondary hover:text-black active:translate-y-0.5"
                        >
                          Make Live
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Column: Question Detail Inspector */}
        <div className="col-span-12 xl:col-span-4 flex flex-col gap-space-md">
          {activeSelected ? (
            <div className="bg-surface-container p-0 shadow-[4px_4px_0px_#000000] flex flex-col border border-black sticky top-20">
              <div className="bg-surface-container-lowest px-space-md py-space-xs flex items-center justify-between border-b-[2px] border-black">
                <span className="font-['Press_Start_2P'] text-[10px] text-primary-container font-bold">
                  CHALLENGE SPECIFICATION
                </span>
                <span className="font-['VT323'] text-[16px] text-tertiary-fixed font-bold">
                  #{activeSelected.order_index}
                </span>
              </div>

              <div className="p-space-md flex flex-col gap-space-md">
                <div className="bg-surface-container-lowest p-space-sm border border-black shadow-[inset_2px_2px_0px_#000000]">
                  <div className="font-['Press_Start_2P'] text-[11px] text-primary-container font-bold">
                    {activeSelected.title}
                  </div>
                  <div className="font-['VT323'] text-[16px] text-on-surface-variant mt-1 flex justify-between">
                    <span>TIER: {activeSelected.tier}</span>
                    <span className="text-secondary font-bold">{activeSelected.max_points} MAX POINTS</span>
                  </div>
                </div>

                {/* Test Cases Inspector */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="font-['Press_Start_2P'] text-[8px] text-on-surface-variant uppercase">
                      TEST CASES ({parseQuestionTestCases(activeSelected.input_data, activeSelected.expected_output).length})
                    </span>
                  </div>

                  <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                    {parseQuestionTestCases(activeSelected.input_data, activeSelected.expected_output).map((tc, idx) => (
                      <div key={tc.id || idx} className="bg-surface-container-lowest p-2 border border-black flex flex-col gap-1 text-[12px] font-mono">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-primary-container">
                            #{idx + 1} {tc.name}
                          </span>
                          <span className={`px-1 text-[9px] uppercase font-bold border border-black ${
                            tc.is_public ? 'bg-secondary text-black' : 'bg-error text-white'
                          }`}>
                            {tc.is_public ? 'Public' : 'Hidden'}
                          </span>
                        </div>
                        <div className="text-[11px] text-tertiary-fixed">
                          <span className="text-on-surface-variant">Input:</span> {tc.input || '(empty)'}
                        </div>
                        {tc.expected_output && (
                          <div className="text-[11px] text-secondary">
                            <span className="text-on-surface-variant">Expected:</span> {tc.expected_output}
                          </div>
                        )}
                        {!tc.is_public && tc.output_hash && (
                          <div className="text-[10px] text-outline font-mono truncate">
                            SHA: {tc.output_hash}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {activeSelected.expected_output && (
                  <div className="flex flex-col gap-1">
                    <span className="font-['Press_Start_2P'] text-[8px] text-secondary uppercase">
                      SECRET EXPECTED OUTPUT (ADMIN ONLY)
                    </span>
                    <pre className="bg-surface-container-lowest p-space-sm border border-black font-['Courier_Prime'] text-[13px] text-secondary overflow-x-auto whitespace-pre-wrap">
                      {activeSelected.expected_output}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-surface-container-lowest p-space-lg border border-black text-center font-['VT323'] text-[18px] text-outline">
              Select a question to inspect specification details.
            </div>
          )}
        </div>
      </div>

      <ForgeQuestionModal isOpen={isForgeModalOpen} onClose={() => setIsForgeModalOpen(false)} />
    </div>
  );
};
