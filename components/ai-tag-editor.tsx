'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface TagOption {
  merchant_names: string[];
  category_tags: string[];
}

interface AITagEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: { merchant_pattern: string; ai_merchant_name: string; ai_category_tag: string; apply_to_existing: boolean }) => void;
  initialData: {
    merchant_pattern: string;
    ai_merchant_name: string;
    ai_category_tag: string;
  };
}

export default function AITagEditor({ isOpen, onClose, onSave, initialData }: AITagEditorProps) {
  const [merchantName, setMerchantName] = useState(initialData.ai_merchant_name);
  const [categoryTag, setCategoryTag] = useState(initialData.ai_category_tag);
  const [applyToExisting, setApplyToExisting] = useState(true);
  const [tagOptions, setTagOptions] = useState<TagOption>({ merchant_names: [], category_tags: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Load tag options on component mount
  useEffect(() => {
    if (isOpen) {
      loadTagOptions();
    }
  }, [isOpen]);

  // Reset form when initialData changes
  useEffect(() => {
    setMerchantName(initialData.ai_merchant_name);
    setCategoryTag(initialData.ai_category_tag);
  }, [initialData]);

  const loadTagOptions = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/tag-options', {
        method: 'GET',
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setTagOptions({
          merchant_names: data.merchant_names || [],
          category_tags: data.category_tags || []
        });
      }
    } catch (error) {
      console.error('Failed to load tag options:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!merchantName.trim() || !categoryTag.trim()) {
      return;
    }

    setIsSaving(true);
    try {
      await onSave({
        merchant_pattern: initialData.merchant_pattern,
        ai_merchant_name: merchantName.trim(),
        ai_category_tag: categoryTag.trim(),
        apply_to_existing: applyToExisting
      });
      onClose();
    } catch (error) {
      console.error('Failed to save tag override:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md p-6 bg-white">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Edit AI Tags</h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </Button>
          </div>

          <div className="space-y-1">
            <Label className="text-sm text-gray-600">Original Merchant:</Label>
            <div className="text-sm font-mono bg-gray-100 p-2 rounded">
              {initialData.merchant_pattern}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="merchant-name">Merchant Name</Label>
            <Input
              id="merchant-name"
              value={merchantName}
              onChange={(e) => setMerchantName(e.target.value)}
              placeholder="Enter merchant name"
              list="merchant-options"
            />
            {!isLoading && (
              <datalist id="merchant-options">
                {tagOptions.merchant_names.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-tag">Category</Label>
            <Input
              id="category-tag"
              value={categoryTag}
              onChange={(e) => setCategoryTag(e.target.value)}
              placeholder="Enter category"
              list="category-options"
            />
            {!isLoading && (
              <datalist id="category-options">
                {tagOptions.category_tags.map((category) => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="apply-existing"
              checked={applyToExisting}
              onChange={(e) => setApplyToExisting(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="apply-existing" className="text-sm">
              Apply to all existing transactions from this merchant
            </Label>
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              variant="outline" 
              onClick={onClose}
              className="flex-1"
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              className="flex-1"
              disabled={isSaving || !merchantName.trim() || !categoryTag.trim()}
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
} 