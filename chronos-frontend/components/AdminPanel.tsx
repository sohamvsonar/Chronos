'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/contexts/ToastContext';

interface Weights {
  collaborative: number;
  content: number;
}

export default function AdminPanel() {
  const [weights, setWeights] = useState<Weights>({ collaborative: 0.5, content: 0.5 });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const { showToast } = useToast();

  useEffect(() => {
    async function fetchWeights() {
      try {
        const data = await api.getWeights();
        if (data.weights) {
          setWeights(data.weights);
        }
      } catch (error) {
        console.error('Failed to fetch weights:', error);
        showToast('Failed to load current weights', 'error');
      } finally {
        setIsLoading(false);
      }
    }

    fetchWeights();
  }, [showToast]);

  const handleCollaborativeChange = (value: number) => {
    const newCollab = Math.round(value * 100) / 100;
    const newContent = Math.round((1 - newCollab) * 100) / 100;
    setWeights({ collaborative: newCollab, content: newContent });
    setHasChanges(true);
  };

  const handleContentChange = (value: number) => {
    const newContent = Math.round(value * 100) / 100;
    const newCollab = Math.round((1 - newContent) * 100) / 100;
    setWeights({ collaborative: newCollab, content: newContent });
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateWeights(weights);
      showToast('Weights updated successfully', 'success');
      setHasChanges(false);
    } catch (error: any) {
      console.error('Failed to update weights:', error);
      showToast(error.message || 'Failed to update weights', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setWeights({ collaborative: 0.5, content: 0.5 });
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="bg-[#0f0f0f] border border-[#2a2a2a] p-8">
        <div className="animate-pulse">
          <div className="h-6 bg-[#1a1a1a] rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-[#1a1a1a] rounded w-2/3 mb-6"></div>
          <div className="h-8 bg-[#1a1a1a] rounded mb-4"></div>
          <div className="h-8 bg-[#1a1a1a] rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#0f0f0f] border border-[#2a2a2a] overflow-hidden">
      {/* Header */}
      <div className="px-8 py-6 border-b border-[#2a2a2a] bg-gradient-to-r from-[#1a1a1a] to-[#0f0f0f]">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full border border-[#d4af37]/30 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#d4af37]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <h2 className="font-display text-xl text-white">Algorithm Configuration</h2>
            <p className="text-[#666666] text-sm">Recommendation Engine Controls</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <p className="text-[#808080] text-sm mb-8 max-w-2xl">
          Fine-tune the recommendation algorithm by adjusting the balance between collaborative filtering
          (based on similar users) and content-based filtering (based on product attributes).
          The weights must sum to 1.0.
        </p>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Collaborative Weight */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-white font-medium mb-1">Collaborative Filtering</h3>
                <p className="text-[#666666] text-xs">Similar users' purchase patterns</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-light text-[#d4af37]">
                  {(weights.collaborative * 100).toFixed(0)}
                </span>
                <span className="text-[#d4af37] text-sm">%</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.collaborative}
              onChange={(e) => handleCollaborativeChange(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-[#d4af37]
                         [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:transition-transform
                         [&::-webkit-slider-thumb]:hover:scale-125"
            />
          </div>

          {/* Content Weight */}
          <div className="bg-[#1a1a1a] border border-[#2a2a2a] p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-white font-medium mb-1">Content-Based</h3>
                <p className="text-[#666666] text-xs">Product attributes & preferences</p>
              </div>
              <div className="text-right">
                <span className="text-3xl font-light text-[#c0c0c0]">
                  {(weights.content * 100).toFixed(0)}
                </span>
                <span className="text-[#c0c0c0] text-sm">%</span>
              </div>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={weights.content}
              onChange={(e) => handleContentChange(parseFloat(e.target.value))}
              className="w-full h-1 bg-[#2a2a2a] rounded-lg appearance-none cursor-pointer
                         [&::-webkit-slider-thumb]:appearance-none
                         [&::-webkit-slider-thumb]:w-4
                         [&::-webkit-slider-thumb]:h-4
                         [&::-webkit-slider-thumb]:rounded-full
                         [&::-webkit-slider-thumb]:bg-[#c0c0c0]
                         [&::-webkit-slider-thumb]:cursor-pointer
                         [&::-webkit-slider-thumb]:transition-transform
                         [&::-webkit-slider-thumb]:hover:scale-125"
            />
          </div>
        </div>

        {/* Visual Balance Indicator */}
        <div className="mt-8 p-6 bg-[#1a1a1a] border border-[#2a2a2a]">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm text-[#808080] tracking-wide uppercase">Weight Distribution</span>
            <span className="text-xs text-[#666666]">
              {weights.collaborative.toFixed(2)} + {weights.content.toFixed(2)} = 1.00
            </span>
          </div>
          <div className="h-2 bg-[#0a0a0a] overflow-hidden flex">
            <div
              className="bg-gradient-to-r from-[#d4af37] to-[#b8960c] transition-all duration-300"
              style={{ width: `${weights.collaborative * 100}%` }}
            />
            <div
              className="bg-gradient-to-r from-[#808080] to-[#c0c0c0] transition-all duration-300"
              style={{ width: `${weights.content * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs mt-3">
            <span className="text-[#d4af37]">Collaborative</span>
            <span className="text-[#c0c0c0]">Content</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 mt-8">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`flex-1 py-3 px-6 text-sm tracking-wide uppercase transition-all duration-300 ${
              hasChanges && !isSaving
                ? 'bg-[#d4af37] text-[#0a0a0a] hover:bg-[#e5c349]'
                : 'bg-[#2a2a2a] text-[#666666] cursor-not-allowed'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="py-3 px-6 text-sm tracking-wide uppercase border border-[#2a2a2a] text-[#808080] hover:border-[#d4af37]/30 hover:text-white transition-all duration-300"
          >
            Reset
          </button>
        </div>

        {hasChanges && (
          <p className="text-[#d4af37]/60 text-xs text-center mt-4 tracking-wide">
            Unsaved changes
          </p>
        )}
      </div>
    </div>
  );
}
