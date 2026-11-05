import React, { useState } from 'react';
import { useArena } from '../context/ArenaContext';
import { QuestionTier } from '../types/database';
import { playSound } from '../lib/audio';

interface ForgeQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ForgeQuestionModal: React.FC<ForgeQuestionModalProps> = ({ isOpen, onClose }) => {
  const { createQuestion } = useArena();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [inputData, setInputData] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [points, setPoints] = useState(500);
  const [tier, setTier] = useState<QuestionTier>('MEDIUM');
  const [category, setCategory] = useState('ALGORITHMS');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !description || !expectedOutput) return;

    setIsSubmitting(true);
    await createQuestion({
      title,
      description,
      input_data: inputData,
      expected_output: expectedOutput,
      max_points: points,
      tier,
      category,
      status: 'locked'
    });
    setIsSubmitting(false);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-2xl bg-surface-container border-[4px] border-primary-container shadow-[8px_8px_0px_#000000] p-0 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Title Bar */}
        <div className="bg-primary-container px-space-md py-space-sm border-b-[4px] border-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-black text-[20px]">add_box</span>
            <span className="font-['Press_Start_2P'] text-[12px] text-black uppercase tracking-wider">
              Add Question
            </span>
          </div>
          <button 
            onClick={onClose}
            className="px-2 py-0.5 bg-black text-primary-container font-['Press_Start_2P'] text-[10px] border border-black hover:bg-error hover:text-white"
          >
            ✕
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-space-lg flex flex-col gap-space-md overflow-y-auto font-['Courier_Prime']">
          <div className="flex flex-col gap-1">
            <label className="font-['Press_Start_2P'] text-[10px] text-primary-container">
              Question Title
            </label>
            <input 
              type="text"
              required
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Reverse Polish Bytecode Evaluator"
              className="bg-surface-container-lowest border-[2px] border-black p-space-sm text-primary text-[15px] focus:outline-none focus:border-primary-container"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-space-sm">
            <div className="flex flex-col gap-1">
              <label className="font-['Press_Start_2P'] text-[9px] text-secondary">
                Difficulty Tier
              </label>
              <select 
                value={tier}
                onChange={e => setTier(e.target.value as QuestionTier)}
                className="bg-surface-container-lowest border-[2px] border-black p-space-sm text-on-surface text-[14px] focus:outline-none"
              >
                <option value="EASY">EASY (200 PTS)</option>
                <option value="MEDIUM">MEDIUM (500 PTS)</option>
                <option value="HARD">HARD (900 PTS)</option>
                <option value="BOSS">BOSS TIER (1,200 PTS)</option>
              </select>
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-['Press_Start_2P'] text-[9px] text-tertiary-fixed">
                Points (Max)
              </label>
              <input 
                type="number"
                value={points}
                onChange={e => setPoints(Number(e.target.value))}
                className="bg-surface-container-lowest border-[2px] border-black p-space-sm text-tertiary-fixed text-[14px] focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-['Press_Start_2P'] text-[9px] text-primary">
                Category
              </label>
              <input 
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Security, Algorithms"
                className="bg-surface-container-lowest border-[2px] border-black p-space-sm text-primary text-[14px] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="font-['Press_Start_2P'] text-[10px] text-on-surface">
              Problem Description
            </label>
            <textarea 
              rows={3}
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the challenge instructions given to the prompt engineer..."
              className="bg-surface-container-lowest border-[2px] border-black p-space-sm text-on-surface text-[14px] focus:outline-none focus:border-primary-container"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-space-sm">
            <div className="flex flex-col gap-1">
              <label className="font-['Press_Start_2P'] text-[9px] text-on-surface-variant">
                Input Data
              </label>
              <textarea 
                rows={3}
                value={inputData}
                onChange={e => setInputData(e.target.value)}
                placeholder='e.g. {"input": "test payload"}'
                className="bg-surface-container-lowest border-[2px] border-black p-space-sm text-tertiary-fixed text-[13px] font-mono focus:outline-none"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label className="font-['Press_Start_2P'] text-[9px] text-error flex items-center gap-1">
                <span>🔒</span> Expected Output (Secret)
              </label>
              <textarea 
                rows={3}
                required
                value={expectedOutput}
                onChange={e => setExpectedOutput(e.target.value)}
                placeholder="Ground-truth expected output. Hidden from all participants."
                className="bg-surface-container-lowest border-[2px] border-error p-space-sm text-error text-[13px] font-mono focus:outline-none"
              />
            </div>
          </div>

          <div className="p-space-xs bg-surface-container-lowest border border-black text-[12px] text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
            <span>Expected output is stored securely in <strong className="text-secondary">question_secrets</strong> table with zero participant visibility.</span>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-space-sm pt-space-xs border-t-[2px] border-black">
            <button 
              type="button"
              onClick={onClose}
              className="px-space-md py-space-sm bg-surface-container-high border-[2px] border-black font-['Press_Start_2P'] text-[10px] text-on-surface-variant hover:text-white"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={isSubmitting}
              className="px-space-lg py-space-sm bg-primary-container text-black font-['Press_Start_2P'] text-[11px] uppercase shadow-[4px_4px_0px_#000000] hover:bg-tertiary-fixed active:translate-x-1 active:translate-y-1 transition-none"
            >
              {isSubmitting ? 'Saving...' : 'Save Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
