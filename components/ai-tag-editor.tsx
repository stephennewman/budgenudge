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

function ComboBox({ 
  value, 
  onChange, 
  options, 
  placeholder,
  id 
}: { 
  value: string; 
  onChange: (value: string) => void; 
  options: string[]; 
  placeholder: string;
  id: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState(value);

  // Sort options alphabetically and filter based on search
  const filteredOptions = options
    .sort((a, b) => a.localeCompare(b))
    .filter(option => 
      option.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .slice(0, 10); // Limit to 10 options for performance

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setSearchTerm(newValue);
    onChange(newValue);
    setIsOpen(true);
  };

  const handleOptionClick = (option: string) => {
    setSearchTerm(option);
    onChange(option);
    setIsOpen(false);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  const handleInputBlur = () => {
    // Delay closing to allow option clicks
    setTimeout(() => setIsOpen(false), 150);
  };

  // Update searchTerm when value changes externally
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  return (
    <div className="relative">
      <Input
        id={id}
        value={searchTerm}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        onBlur={handleInputBlur}
        placeholder={placeholder}
        autoComplete="off"
      />
      
      {isOpen && filteredOptions.length > 0 && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-48 overflow-y-auto">
          {filteredOptions.map((option, index) => (
            <button
              key={index}
              type="button"
              className="w-full px-3 py-2 text-left hover:bg-gray-100 focus:bg-gray-100 focus:outline-none text-sm"
              onMouseDown={(e) => e.preventDefault()} // Prevent input blur
              onClick={() => handleOptionClick(option)}
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
            {isLoading ? (
              <Input
                id="merchant-name"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                placeholder="Loading options..."
                disabled
              />
            ) : (
              <ComboBox
                id="merchant-name"
                value={merchantName}
                onChange={setMerchantName}
                options={tagOptions.merchant_names}
                placeholder="Enter or search merchant name"
              />
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="category-tag">Category</Label>
            {isLoading ? (
              <Input
                id="category-tag"
                value={categoryTag}
                onChange={(e) => setCategoryTag(e.target.value)}
                placeholder="Loading options..."
                disabled
              />
            ) : (
              <ComboBox
                id="category-tag"
                value={categoryTag}
                onChange={setCategoryTag}
                options={tagOptions.category_tags}
                placeholder="Enter or search category"
              />
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