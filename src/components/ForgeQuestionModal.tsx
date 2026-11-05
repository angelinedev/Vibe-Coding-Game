import React, { useState } from 'react';
import { useArena } from '../context/ArenaContext';
import { QuestionTier } from '../types/database';
import { normalizeOutput, sha256Hex } from '../lib/testcases';

interface ForgeQuestionModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface DraftTestCase {
  id: string;
  name: string;
  input: string;
  expected_output: string;
  is_public: boolean;
}

export const ForgeQuestionModal: React.FC<ForgeQuestionModalProps> = ({ isOpen, onClose }) => {
  const { createQuestion } = useArena();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [points, setPoints] = useState(500);
  const [tier, setTier] = useState<QuestionTier>('MEDIUM');
  const [category, setCategory] = useState('ALGORITHMS');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [testCases, setTestCases] = useState<DraftTestCase[]>([
    {
      id: '1',
      name: 'Sample Case #1',
      input: '',
      expected_output: '',
      is_public: true,
    },
    {
      id: '2',
      name: 'Hidden Case #2',
      input: '',
      expected_output: '',
      is_public: false,
    },
  ]);

  if (!isOpen) return null;

  const handleAddTestCase = () => {
    const nextIdx = testCases.length + 1;
    setTestCases(prev => [
      ...prev,
      {
        id: String(Date.now()),
        name: `Hidden Case #${nextIdx}`,
        input: '',
        expected_output: '',
        is_public: false,
      },
    ]);
  };

  const handleRemoveTestCase = (id: string) => {
    if (testCases.length <= 1) return;
    setTestCases(prev => prev.filter(tc => tc.id !== id));
  };

  const handleUpdateTestCase = (id: string, field: keyof DraftTestCase, val: any) => {
    setTestCases(prev =>
      prev.map(tc => {
        if (tc.id !== id) return tc;
        const updated = { ...tc, [field]: val };
        // Auto-update default names if user hasn't customized
        if (field === 'is_public' && (tc.name.startsWith('Sample Case') || tc.name.startsWith('Hidden Case'))) {
          const idx = prev.findIndex(item => item.id === id) + 1;
          updated.name = val ? `Sample Case #${idx}` : `Hidden Case #${idx}`;
        }
        return updated;
      })
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    // Validate that at least one testcase has an expected output
    const validTestCases = testCases.filter(tc => tc.expected_output.trim() !== '');
    if (validTestCases.length === 0) {
      alert('Please provide expected output for at least one test case.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Build public test case payload with hashes for hidden cases
      const publicCasesPayload = await Promise.all(
        validTestCases.map(async (tc, idx) => {
          if (tc.is_public) {
            return {
              id: String(idx + 1),
              name: tc.name || `Sample Case #${idx + 1}`,
              input: tc.input,
              expected_output: tc.expected_output,
              is_public: true,
            };
          } else {
            const hash = await sha256Hex(normalizeOutput(tc.expected_output));
            return {
              id: String(idx + 1),
              name: tc.name || `Hidden Case #${idx + 1}`,
              input: tc.input,
              output_hash: hash,
              is_public: false,
            };
          }
        })
      );

      // Build full secret payload for admins with ground truth
      const secretCasesPayload = validTestCases.map((tc, idx) => ({
        id: String(idx + 1),
        name: tc.name,
        input: tc.input,
        expected_output: tc.expected_output,
        is_public: tc.is_public,
      }));

      await createQuestion({
        title: title.trim(),
        description: description.trim(),
        input_data: JSON.stringify(publicCasesPayload),
        expected_output: JSON.stringify(secretCasesPayload),
        max_points: points,
        tier,
        category: category.trim(),
        status: 'locked',
      });

      setIsSubmitting(false);
      onClose();
    } catch (err: any) {
      console.error('Failed to create question:', err);
      alert('Failed to save question: ' + (err?.message || 'Unknown error'));
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
      <div className="w-full max-w-3xl bg-surface-container border-[4px] border-primary-container shadow-[8px_8px_0px_#000000] p-0 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Title Bar */}
        <div className="bg-primary-container px-space-md py-space-sm border-b-[4px] border-black flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-black text-[20px]">add_box</span>
            <span className="font-['Press_Start_2P'] text-[12px] text-black uppercase tracking-wider">
              Add Question &amp; Test Cases
            </span>
          </div>
          <button
            type="button"
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
              rows={2}
              required
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Describe the challenge instructions given to the prompt engineer..."
              className="bg-surface-container-lowest border-[2px] border-black p-space-sm text-on-surface text-[14px] focus:outline-none focus:border-primary-container"
            />
          </div>

          {/* TEST CASES SECTION */}
          <div className="flex flex-col gap-2 pt-2 border-t-2 border-black/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-['Press_Start_2P'] text-[11px] text-tertiary-fixed">
                  Test Cases Suite ({testCases.length})
                </span>
                <span className="text-[12px] text-on-surface-variant font-mono">
                  • Split between Public Samples &amp; Hidden Tests
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddTestCase}
                className="px-space-sm py-1 bg-tertiary-fixed text-black font-['Press_Start_2P'] text-[9px] uppercase shadow-[2px_2px_0px_#000000] hover:bg-tertiary font-bold flex items-center gap-1 active:translate-y-0.5 cursor-pointer"
              >
                <span>+ Add Test Case</span>
              </button>
            </div>

            {/* Test Case Cards List */}
            <div className="flex flex-col gap-3">
              {testCases.map((tc, idx) => (
                <div
                  key={tc.id}
                  className="bg-surface-container-low border-2 border-black p-space-sm shadow-[3px_3px_0px_#000000] flex flex-col gap-2"
                >
                  <div className="flex items-center justify-between bg-surface-container-lowest px-2 py-1 border border-black">
                    <div className="flex items-center gap-2">
                      <span className="font-['Press_Start_2P'] text-[9px] text-primary-container font-bold">
                        #{idx + 1}
                      </span>
                      <input
                        type="text"
                        value={tc.name}
                        onChange={e => handleUpdateTestCase(tc.id, 'name', e.target.value)}
                        placeholder="Test case label"
                        className="bg-transparent text-[13px] font-bold text-on-surface focus:outline-none"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Public / Private Toggle */}
                      <button
                        type="button"
                        onClick={() => handleUpdateTestCase(tc.id, 'is_public', !tc.is_public)}
                        className={`px-2 py-0.5 font-['Press_Start_2P'] text-[8px] uppercase border border-black shadow-[1px_1px_0px_#000000] cursor-pointer ${
                          tc.is_public
                            ? 'bg-secondary text-black font-bold'
                            : 'bg-error-container text-white font-bold'
                        }`}
                        title={
                          tc.is_public
                            ? 'Public Sample: Visible to student in the arena'
                            : 'Private Hidden: Output hidden from student; evaluated for score'
                        }
                      >
                        {tc.is_public ? '👁 Public Sample' : '🔒 Private Hidden'}
                      </button>

                      {testCases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveTestCase(tc.id)}
                          className="px-1.5 py-0.5 bg-black text-outline hover:text-error text-[12px] font-bold"
                          title="Remove test case"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <div className="flex flex-col gap-1">
                      <label className="font-['Press_Start_2P'] text-[8px] text-on-surface-variant flex items-center justify-between">
                        <span>Input Data</span>
                        <span className="text-[9px] font-mono lowercase">passed to prompt</span>
                      </label>
                      <textarea
                        rows={2}
                        value={tc.input}
                        onChange={e => handleUpdateTestCase(tc.id, 'input', e.target.value)}
                        placeholder='e.g. 5 or {"numbers": [1, 2, 3]}'
                        className="bg-surface-container-lowest border border-black p-1.5 text-tertiary-fixed text-[13px] font-mono focus:outline-none"
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="font-['Press_Start_2P'] text-[8px] text-on-surface-variant flex items-center justify-between">
                        <span className={tc.is_public ? 'text-secondary' : 'text-error'}>
                          Expected Output {tc.is_public ? '(Public)' : '(Secret)'}
                        </span>
                        <span className="text-[9px] font-mono lowercase">ground truth</span>
                      </label>
                      <textarea
                        rows={2}
                        required
                        value={tc.expected_output}
                        onChange={e => handleUpdateTestCase(tc.id, 'expected_output', e.target.value)}
                        placeholder="Expected answer or JSON"
                        className={`bg-surface-container-lowest border p-1.5 text-[13px] font-mono focus:outline-none ${
                          tc.is_public ? 'border-black text-secondary' : 'border-error text-error'
                        }`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="p-space-xs bg-surface-container-lowest border border-black text-[12px] text-on-surface-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-secondary">verified_user</span>
            <span>
              Hidden test cases use cryptographic SHA-256 validation. Expected outputs are never leaked to contestant browsers.
            </span>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-end gap-space-sm pt-space-xs border-t-[2px] border-black">
            <button
              type="button"
              onClick={onClose}
              className="px-space-md py-space-sm bg-surface-container-high border-[2px] border-black font-['Press_Start_2P'] text-[10px] text-on-surface-variant hover:text-white cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-space-lg py-space-sm bg-primary-container text-black font-['Press_Start_2P'] text-[11px] uppercase shadow-[4px_4px_0px_#000000] hover:bg-tertiary-fixed active:translate-x-1 active:translate-y-1 transition-none font-bold cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving Question...' : 'Save Question'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
