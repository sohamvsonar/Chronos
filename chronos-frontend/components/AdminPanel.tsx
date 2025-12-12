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

  // Fetch current weights on mount
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

  // Handle collaborative weight change (content adjusts automatically)
  const handleCollaborativeChange = (value: number) => {
    const newCollab = Math.round(value * 100) / 100; // Round to 2 decimal places
    const newContent = Math.round((1 - newCollab) * 100) / 100;
    setWeights({ collaborative: newCollab, content: newContent });
    setHasChanges(true);
  };

  // Handle content weight change (collaborative adjusts automatically)
  const handleContentChange = (value: number) => {
    const newContent = Math.round(value * 100) / 100;
    const newCollab = Math.round((1 - newContent) * 100) / 100;
    setWeights({ collaborative: newCollab, content: newContent });
    setHasChanges(true);
  };

  // Save weights
  const handleSave = async () => {
    setIsSaving(true);
    try {
      await api.updateWeights(weights);
      showToast('Weights updated successfully!', 'success');
      setHasChanges(false);
    } catch (error: any) {
      console.error('Failed to update weights:', error);
      showToast(error.message || 'Failed to update weights', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Reset to defaults
  const handleReset = () => {
    setWeights({ collaborative: 0.5, content: 0.5 });
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl p-6 text-white">
        <div className="animate-pulse">
          <div className="h-6 bg-white/20 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-white/20 rounded w-2/3 mb-6"></div>
          <div className="h-8 bg-white/20 rounded mb-4"></div>
          <div className="h-8 bg-white/20 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-xl p-6 text-white shadow-xl">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">&#9881;</span>
        <h2 className="text-xl font-bold">Admin: Recommendation Weights</h2>
      </div>

      <p className="text-purple-200 mb-6 text-sm">
        Adjust the balance between collaborative filtering and content-based recommendations.
        Weights must sum to 1.0.
      </p>

      <div className="space-y-6">
        {/* Collaborative Weight */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="font-medium">Collaborative Filtering</label>
            <span className="text-lg font-bold text-purple-300">
              {(weights.collaborative * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.collaborative}
            onChange={(e) => handleCollaborativeChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-purple-700 rounded-lg appearance-none cursor-pointer accent-purple-400"
          />
          <p className="text-xs text-purple-300 mt-1">
            Based on similar users' purchase patterns
          </p>
        </div>

        {/* Content Weight */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="font-medium">Content-Based</label>
            <span className="text-lg font-bold text-indigo-300">
              {(weights.content * 100).toFixed(0)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weights.content}
            onChange={(e) => handleContentChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-indigo-700 rounded-lg appearance-none cursor-pointer accent-indigo-400"
          />
          <p className="text-xs text-indigo-300 mt-1">
            Based on product attributes and user preferences
          </p>
        </div>

        {/* Visual Balance Indicator */}
        <div className="bg-black/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-medium">Weight Distribution</span>
          </div>
          <div className="h-4 rounded-full overflow-hidden flex">
            <div
              className="bg-purple-500 transition-all duration-300"
              style={{ width: `${weights.collaborative * 100}%` }}
            ></div>
            <div
              className="bg-indigo-500 transition-all duration-300"
              style={{ width: `${weights.content * 100}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs mt-1">
            <span className="text-purple-300">Collaborative: {weights.collaborative.toFixed(2)}</span>
            <span className="text-indigo-300">Content: {weights.content.toFixed(2)}</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
              hasChanges && !isSaving
                ? 'bg-green-500 hover:bg-green-600 text-white'
                : 'bg-gray-600 text-gray-400 cursor-not-allowed'
            }`}
          >
            {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleReset}
            disabled={isSaving}
            className="py-2 px-4 rounded-lg font-medium bg-white/10 hover:bg-white/20 transition-all"
          >
            Reset to 50/50
          </button>
        </div>

        {hasChanges && (
          <p className="text-yellow-300 text-xs text-center">
            You have unsaved changes
          </p>
        )}
      </div>
    </div>
  );
}
