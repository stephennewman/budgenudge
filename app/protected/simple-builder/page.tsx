'use client';

import { DndContext, DragEndEvent, useDraggable, useDroppable } from '@dnd-kit/core';
import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface SavedTemplate {
  id: string;
  template_name: string;
  template_content: string;
  variables_used: string[];
  created_at: string;
  updated_at: string;
}

interface CadenceConfig {
  day?: string;
  interval?: number;
  day_of_month?: number;
}

interface ScheduleConfig {
  cadence_type: 'daily' | 'weekly' | 'bi-weekly' | 'monthly' | 'custom';
  cadence_config: CadenceConfig;
  send_time: string;
  timezone: string;
  is_active: boolean;
}

interface TemplateSchedule {
  id: string;
  template_id: string;
  cadence_type: string;
  cadence_config: CadenceConfig;
  send_time: string;
  timezone: string;
  is_active: boolean;
  next_send_at: string | null;
  last_sent_at: string | null;
}

export default function SimpleBuilderPage() {
  const [canvasItems, setCanvasItems] = useState<string[]>([]);
  const [previewText, setPreviewText] = useState('');
  const [templateName, setTemplateName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<SavedTemplate[]>([]);
  const [currentTemplateId, setCurrentTemplateId] = useState<string | null>(null);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);
  
  // Track if template has unsaved changes
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Scheduling state
  const [schedule, setSchedule] = useState<ScheduleConfig>({
    cadence_type: 'weekly',
    cadence_config: { day: 'monday' },
    send_time: '12:00',
    timezone: 'America/New_York',
    is_active: false
  });
  const [currentSchedule, setCurrentSchedule] = useState<TemplateSchedule | null>(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);
  const [sendFirstSmsNow, setSendFirstSmsNow] = useState(false);

  // Load saved templates on component mount
  useEffect(() => {
    loadSavedTemplates();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track changes to template content
  useEffect(() => {
    if (currentTemplateId) {
      // Check if current content differs from saved template
      const currentTemplate = savedTemplates.find(t => t.id === currentTemplateId);
      if (currentTemplate) {
        const contentChanged = currentTemplate.template_content !== previewText;
        const nameChanged = currentTemplate.template_name !== templateName;
        const variablesChanged = JSON.stringify(currentTemplate.variables_used) !== JSON.stringify(canvasItems);
        setHasUnsavedChanges(contentChanged || nameChanged || variablesChanged);
      } else {
        setHasUnsavedChanges(false);
      }
    } else {
      // New template - mark as having changes if there's content
      setHasUnsavedChanges(previewText.trim().length > 0 || templateName.trim().length > 0);
    }
  }, [previewText, templateName, canvasItems, currentTemplateId, savedTemplates]);

  const loadSavedTemplates = async (autoLoadRecent: boolean = true) => {
    setIsLoadingTemplates(true);
    try {
      const response = await fetch('/api/custom-templates');
      if (response.ok) {
        const data = await response.json();
        setSavedTemplates(data.templates || []);
        
        // Only auto-load the most recent template on initial load
        if (autoLoadRecent) {
          if (data.templates && data.templates.length > 0) {
            const mostRecent = data.templates[0]; // API returns sorted by updated_at DESC
            loadTemplate(mostRecent);
          } else {
            // No saved templates, create a new one
            createNewTemplate();
          }
        }
      } else {
        console.error('Failed to load templates');
        if (autoLoadRecent) {
          createNewTemplate();
        }
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      if (autoLoadRecent) {
        createNewTemplate();
      }
    } finally {
      setIsLoadingTemplates(false);
    }
  };

  const generateDefaultName = () => {
    const timestamp = new Date().toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
    return `My Template ${timestamp}`;
  };

  const createNewTemplate = () => {
    setCurrentTemplateId(null);
    setTemplateName(generateDefaultName());
    setCanvasItems([]);
    setPreviewText('');
    setSaveMessage('');
    setHasUnsavedChanges(false);
  };

  const loadTemplate = async (template: SavedTemplate) => {
    setCurrentTemplateId(template.id);
    setTemplateName(template.template_name);
    
    // Convert variable placeholders back to display text for immediate preview
    let displayText = template.template_content;
    
    // Replace variable placeholders with actual values for display
    for (const variableId of template.variables_used) {
      try {
        const variableValue = await fetchVariableData(variableId);
        displayText = displayText.replace(new RegExp(`{{${variableId}}}`, 'g'), variableValue);
      } catch (error) {
        console.error(`Error fetching variable ${variableId}:`, error);
      }
    }
    
    setPreviewText(displayText);
    setCanvasItems(template.variables_used);
    setSaveMessage('');
    setHasUnsavedChanges(false);
    await loadTemplateSchedule(template.id);
  };

  const loadTemplateSchedule = async (templateId: string) => {
    try {
      const response = await fetch(`/api/template-schedules/${templateId}`);
      if (response.ok) {
        const data = await response.json();
        if (data.schedule) {
          setCurrentSchedule(data.schedule);
          setSchedule({
            cadence_type: data.schedule.cadence_type,
            cadence_config: data.schedule.cadence_config,
            send_time: data.schedule.send_time,
            timezone: data.schedule.timezone,
            is_active: data.schedule.is_active
          });
        } else {
          // No schedule exists, reset to defaults
          setCurrentSchedule(null);
          setSchedule({
            cadence_type: 'weekly',
            cadence_config: { day: 'monday' },
            send_time: '12:00',
            timezone: 'America/New_York',
            is_active: false
          });
        }
      }
    } catch (error) {
      console.error('Error loading template schedule:', error);
    }
  };

  const handleSaveSchedule = async () => {
    if (!currentTemplateId) {
      setSaveMessage('❌ Please save the template first');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    setIsSavingSchedule(true);
    
    try {
      const response = await fetch('/api/template-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: currentTemplateId,
          schedule: schedule,
          sendFirstSmsNow: sendFirstSmsNow
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setCurrentSchedule(result.schedule);
        setSaveMessage(result.message || '✅ Schedule saved successfully!');
        setSendFirstSmsNow(false); // Reset checkbox after successful save
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage(`❌ ${result.error || 'Failed to save schedule'}`);
        setTimeout(() => setSaveMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error saving schedule:', error);
      setSaveMessage('❌ Error saving schedule');
      setTimeout(() => setSaveMessage(''), 5000);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const formatNextSend = () => {
    if (!currentSchedule || !currentSchedule.next_send_at) return 'Not scheduled';
    
    const nextSend = new Date(currentSchedule.next_send_at);
    return nextSend.toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short'
    });
  };

  // Function to fetch variable data directly from Supabase
  const fetchVariableData = async (variableId: string): Promise<string> => {
    const supabase = createClientComponentClient();
    
    try {
      switch (variableId) {
        case 'today-date':
          return new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
          
        case 'account-count':
          // Get user's Plaid items first, then count accounts linked to those items
          const { data: userItems } = await supabase
            .from('items')
            .select('id')
            .limit(10);
          
          if (userItems && userItems.length > 0) {
            const itemIds = userItems.map(item => item.id);
            const { count: accountCount } = await supabase
              .from('accounts')
              .select('*', { count: 'exact', head: true })
              .in('item_id', itemIds)
              .is('deleted_at', null);
            return `${accountCount || 0} account${(accountCount || 0) !== 1 ? 's' : ''} connected`;
          }
          return '0 accounts connected';
          
        case 'last-transaction-date':
          // Get user's Plaid items first, then get transactions linked to those items
          const { data: userItemsForTx } = await supabase
            .from('items')
            .select('plaid_item_id')
            .limit(10);
          
          if (userItemsForTx && userItemsForTx.length > 0) {
            const plaidItemIds = userItemsForTx.map(item => item.plaid_item_id);
            const { data: lastTransaction } = await supabase
              .from('transactions')
              .select('date')
              .in('plaid_item_id', plaidItemIds)
              .order('date', { ascending: false })
              .limit(1)
              .single();
            
            if (lastTransaction) {
              const date = new Date(lastTransaction.date);
              return date.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long', 
                day: 'numeric'
              });
            }
          }
          return 'No transactions found';
          
        case 'total-balance':
          // Get user's Plaid items first, then get account balances linked to those items
          const { data: userItemsForBalance } = await supabase
            .from('items')
            .select('id')
            .limit(10);
          
          if (userItemsForBalance && userItemsForBalance.length > 0) {
            const itemIds = userItemsForBalance.map(item => item.id);
            const { data: accounts } = await supabase
              .from('accounts')
              .select('available_balance, current_balance')
              .in('item_id', itemIds)
              .is('deleted_at', null);
            
            if (accounts && accounts.length > 0) {
              const totalBalance = accounts.reduce((sum, acc) => {
                const balance = acc.available_balance ?? acc.current_balance ?? 0;
                return sum + balance;
              }, 0);
              return `$${totalBalance.toLocaleString('en-US', {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
              })}`;
            }
          }
          return 'No accounts found';
          
        default:
          return `[${variableId} - Unknown Variable]`;
      }
    } catch (error) {
      console.error(`Error fetching variable ${variableId}:`, error);
      return `[${variableId} - Error]`;
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { over, active } = event;
    
    if (over?.id === 'canvas') {
      const variableId = active.id as string;
      
      // Add the variable to canvas
      setCanvasItems(prev => [...prev, variableId]);
      
      // Fetch the variable value directly from Supabase
      try {
        const variableValue = await fetchVariableData(variableId);
        setPreviewText(prev => prev + (prev ? '\n' : '') + variableValue);
      } catch (error) {
        console.error('Error fetching variable value:', error);
        setPreviewText(prev => prev + (prev ? '\n' : '') + `[${variableId} - Error]`);
      }
    }
  };

  const handleSendTest = async () => {
    if (!previewText) {
      alert('Add something to the canvas first!');
      return;
    }

    try {
      const response = await fetch('/api/send-test-custom-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: previewText,
          templateName: templateName 
        })
      });

      if (response.ok) {
        alert('Test SMS sent!');
      } else {
        const error = await response.json();
        alert(`Failed to send SMS: ${error.error}`);
      }
    } catch (error) {
      alert('Error sending SMS');
      console.error('SMS error:', error);
    }
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      setSaveMessage('❌ Please enter a template name');
      setTimeout(() => setSaveMessage(''), 3000);
      return;
    }

    setIsSaving(true);
    
    try {
      // Convert real values back to placeholders for storage
      let templateContent = previewText;
      
      // Replace real values with placeholders
      const variableRegex = /{{([^}]+)}}/g;
      const matches = previewText.match(variableRegex);
      
      if (matches) {
        for (const match of matches) {
          const variableName = match.slice(2, -2); // Remove {{ and }}
          
          try {
            const variableValue = await fetchVariableData(variableName);
            // Replace the real value with the placeholder
            templateContent = templateContent.replace(new RegExp(variableValue, 'g'), `{{${variableName}}}`);
          } catch (error) {
            console.error(`Error processing variable ${variableName}:`, error);
          }
        }
      }

      const response = await fetch('/api/custom-sms-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          content: templateContent
        })
      });

      const result = await response.json();
      
      if (response.ok) {
        setCurrentTemplateId(result.template.id);
        setSaveMessage('✅ Template saved successfully!');
        setHasUnsavedChanges(false);
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage(`❌ ${result.error || 'Failed to save template'}`);
        setTimeout(() => setSaveMessage(''), 5000);
      }
    } catch (error) {
      console.error('Error saving template:', error);
      setSaveMessage('❌ Error saving template');
      setTimeout(() => setSaveMessage(''), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">📱 Simple SMS Builder</h1>
        
        {isLoadingTemplates ? (
          <div className="mb-6 flex items-center space-x-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            <span className="text-gray-600">Loading templates...</span>
          </div>
        ) : (
          <>
            {/* Template Management */}
            <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Template
                  </label>
                  <select
                    value={currentTemplateId || ''}
                    onChange={(e) => {
                      const templateId = e.target.value;
                      if (templateId) {
                        const template = savedTemplates.find(t => t.id === templateId);
                        if (template) loadTemplate(template);
                      }
                    }}
                    className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {!currentTemplateId && <option value="">Select a template...</option>}
                    {savedTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.template_name}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={createNewTemplate}
                  className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors whitespace-nowrap"
                >
                  + New Template
                </button>
              </div>
              
              {savedTemplates.length > 0 && (
                <div className="mt-3 text-sm text-gray-600">
                  {savedTemplates.length} saved template{savedTemplates.length !== 1 ? 's' : ''}
                </div>
              )}
            </div>
          </>
        )}
        
        {/* Template Name Input */}
        <div className="mb-6">
          <label htmlFor="template-name" className="block text-sm font-medium text-gray-700 mb-2">
            Template Name
          </label>
          <div className="flex gap-3 items-start">
            <input
              id="template-name"
              type="text"
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="flex-1 max-w-md px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter template name..."
            />
            <button
              onClick={handleSaveTemplate}
              disabled={isSaving || !templateName.trim() || !previewText.trim() || !hasUnsavedChanges}
              className={`px-4 py-2 text-white rounded-md transition-colors flex items-center gap-2 ${
                hasUnsavedChanges 
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-gray-400 cursor-not-allowed'
              } disabled:bg-gray-300 disabled:cursor-not-allowed`}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  💾 {hasUnsavedChanges ? 'Save Template' : 'No Changes'}
                </>
              )}
            </button>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              This name will appear in your test SMS messages
            </p>
            {saveMessage && (
              <p className={`text-sm font-medium ${
                saveMessage.startsWith('✅') ? 'text-green-600' : 'text-red-600'
              }`}>
                {saveMessage}
              </p>
            )}
          </div>
        </div>
        
        {/* Schedule Settings */}
        {currentTemplateId && (
          <div className="mb-6 p-4 bg-white rounded-lg shadow-sm border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">📅 Schedule Settings</h3>
              <div className="flex items-center gap-2">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={schedule.is_active}
                    onChange={(e) => setSchedule(prev => ({ ...prev, is_active: e.target.checked }))}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700">
                    {schedule.is_active ? 'Active' : 'Inactive'}
                  </span>
                </label>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Cadence */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Frequency
                </label>
                <select
                  value={schedule.cadence_type}
                  onChange={(e) => {
                    const cadenceType = e.target.value as ScheduleConfig['cadence_type'];
                    setSchedule(prev => ({
                      ...prev,
                      cadence_type: cadenceType,
                      cadence_config: cadenceType === 'weekly' ? { day: 'monday' } : 
                                     cadenceType === 'bi-weekly' ? { day: 'monday', interval: 2 } :
                                     cadenceType === 'monthly' ? { day_of_month: 1 } : {}
                    }));
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="bi-weekly">Bi-weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>

              {/* Day Selection for Weekly/Bi-weekly */}
              {(schedule.cadence_type === 'weekly' || schedule.cadence_type === 'bi-weekly') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Day of Week
                  </label>
                  <select
                    value={schedule.cadence_config?.day || 'monday'}
                    onChange={(e) => setSchedule(prev => ({
                      ...prev,
                      cadence_config: { ...prev.cadence_config, day: e.target.value }
                    }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="monday">Monday</option>
                    <option value="tuesday">Tuesday</option>
                    <option value="wednesday">Wednesday</option>
                    <option value="thursday">Thursday</option>
                    <option value="friday">Friday</option>
                    <option value="saturday">Saturday</option>
                    <option value="sunday">Sunday</option>
                  </select>
                </div>
              )}

              {/* Time */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Time
                </label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={schedule.send_time}
                    onChange={(e) => setSchedule(prev => ({ ...prev, send_time: e.target.value }))}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <select
                    value={schedule.timezone}
                    onChange={(e) => setSchedule(prev => ({ ...prev, timezone: e.target.value }))}
                    className="px-2 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-xs"
                  >
                    <option value="America/New_York">EST</option>
                    <option value="America/Chicago">CST</option>
                    <option value="America/Denver">MST</option>
                    <option value="America/Los_Angeles">PST</option>
                  </select>
                </div>
              </div>
            </div>

                                    {/* Send First SMS Option */}
                        <div className="mt-4 flex items-center gap-4">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={sendFirstSmsNow}
                              onChange={(e) => setSendFirstSmsNow(e.target.checked)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700">Send first SMS now (test the schedule immediately)</span>
                          </label>
                        </div>

                        {/* Save Schedule Button & Status */}
                        <div className="mt-4 flex items-center justify-between">
                          <div className="text-sm text-gray-600">
                            {currentSchedule && schedule.is_active ? (
                              <span>Next SMS: <strong>{formatNextSend()}</strong></span>
                            ) : (
                              <span>Schedule inactive</span>
                            )}
                          </div>

                          <button
                            onClick={handleSaveSchedule}
                            disabled={isSavingSchedule}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                          >
                            {isSavingSchedule ? (
                              <>
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                Saving...
                              </>
                            ) : (
                              <>
                                📅 {sendFirstSmsNow ? 'Save & Send Now' : 'Save Schedule'}
                              </>
                            )}
                          </button>
                        </div>
          </div>
        )}
        
        <DndContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-96">
            
            {/* Variables Library */}
            <div className="bg-white rounded-lg p-4 border-2">
              <h2 className="font-semibold mb-4">📦 Variables</h2>
              <DraggableVariable />
            </div>

            {/* Canvas */}
            <div className="bg-white rounded-lg p-4 border-2">
              <h2 className="font-semibold mb-4">🎨 Canvas</h2>
              <DropZone 
                canvasItems={canvasItems} 
                onRemoveVariable={(index) => {
                  const newItems = canvasItems.filter((_, i) => i !== index);
                  setCanvasItems(newItems);
                  // Also need to update preview text - remove the corresponding line
                  const lines = previewText.split('\n');
                  lines.splice(index, 1);
                  setPreviewText(lines.join('\n'));
                }} 
              />
            </div>

            {/* Preview */}
            <div className="bg-white rounded-lg p-4 border-2">
              <h2 className="font-semibold mb-4">📱 Preview</h2>
              <PreviewPanel 
                previewText={previewText}
                templateName={templateName}
                onSendTest={handleSendTest}
              />
            </div>
            
          </div>
        </DndContext>
      </div>
    </div>
  );
}

// Draggable Variable Component
function DraggableVariable() {
  const [variables] = useState([
    { id: 'today-date', label: 'Today\'s Date', icon: '📅', description: 'Current date in long format' },
    { id: 'account-count', label: 'Account Count', icon: '🏦', description: 'Number of connected accounts' },
    { id: 'last-transaction-date', label: 'Last Transaction', icon: '💳', description: 'Most recent transaction date' },
    { id: 'total-balance', label: 'Total Balance', icon: '💰', description: 'Combined balance from all accounts' }
  ]);

  return (
    <div className="space-y-3">
      {variables.map((variable) => (
        <DraggableVariableItem key={variable.id} variable={variable} />
      ))}
    </div>
  );
}

// Individual Draggable Variable Item
function DraggableVariableItem({ variable }: { variable: { id: string; label: string; icon: string; description: string } }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: variable.id,
  });

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`p-3 bg-blue-50 border-2 border-blue-200 rounded-lg cursor-grab hover:bg-blue-100 transition-colors ${
        isDragging ? 'opacity-50' : ''
      }`}
    >
      <div className="flex items-center space-x-2">
        <span className="text-xl">{variable.icon}</span>
        <div>
          <p className="font-medium">{variable.label}</p>
          <p className="text-sm text-gray-500">{variable.description}</p>
        </div>
      </div>
    </div>
  );
}

// Drop Zone Component
function DropZone({ canvasItems, onRemoveVariable }: { 
  canvasItems: string[]; 
  onRemoveVariable: (index: number) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: 'canvas',
  });

  const getVariableLabel = (variableId: string) => {
    switch (variableId) {
      case 'today-date':
        return '📅 Today\'s Date';
      case 'account-count':
        return '🏦 Account Count';
      case 'last-transaction-date':
        return '💳 Last Transaction';
      case 'total-balance':
        return '💰 Total Balance';
      default:
        return `📱 ${variableId}`;
    }
  };

  return (
    <div 
      ref={setNodeRef}
      className={`min-h-[200px] border-2 border-dashed rounded-lg p-4 transition-colors ${
        isOver 
          ? 'border-blue-400 bg-blue-50' 
          : 'border-gray-300 bg-gray-50'
      }`}
    >
      {canvasItems.length === 0 ? (
        <div className="h-full flex items-center justify-center text-gray-500">
          <div className="text-center">
            <div className="text-3xl mb-2">📱</div>
            <p>Drop variables here</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {canvasItems.map((item, index) => (
            <div key={index} className="p-2 bg-blue-100 rounded border flex items-center justify-between">
              <span>{getVariableLabel(item)}</span>
              <button 
                onClick={() => onRemoveVariable(index)}
                className="text-red-500 hover:text-red-700 px-2"
                title="Remove"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Preview Panel Component
function PreviewPanel({ previewText, templateName, onSendTest }: { 
  previewText: string;
  templateName: string;
  onSendTest: () => void; 
}) {
  const [realPreviewText, setRealPreviewText] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Update preview with real values
  useEffect(() => {
    const updatePreview = async () => {
      if (previewText.trim()) {
        setIsLoading(true);
        
        try {
          let result = previewText;
          
          // Replace placeholders with real values
          const variableRegex = /{{([^}]+)}}/g;
          const matches = previewText.match(variableRegex);
          
          if (matches) {
            for (const match of matches) {
              const variableName = match.slice(2, -2); // Remove {{ and }}
              
              try {
                const variableValue = await fetchVariableData(variableName);
                result = result.replace(new RegExp(`{{${variableName}}}`, 'g'), variableValue);
              } catch (error) {
                console.error(`Error fetching variable ${variableName}:`, error);
              }
            }
          }
          
          setRealPreviewText(result);
        } catch (error) {
          console.error('Error updating preview:', error);
          setRealPreviewText(previewText);
        } finally {
          setIsLoading(false);
        }
      } else {
        setRealPreviewText('');
      }
    };

    updatePreview();
  }, [previewText]);

  // Format the full message as it will appear in SMS
  const fullMessage = realPreviewText 
    ? `🧪 ${templateName}: \n\n${realPreviewText}`
    : 'Your message preview will appear here...';
    
  const characterCount = fullMessage.length;
  const smsSegments = Math.ceil(characterCount / 160) || 1;

  return (
    <div className="space-y-4">
      {/* Phone Mockup */}
      <div className="bg-gray-900 rounded-2xl p-4">
        <div className="bg-gray-800 rounded-xl p-3 min-h-[120px]">
          <div className="bg-blue-500 rounded-xl p-2 text-white text-sm whitespace-pre-line">
            {isLoading ? (
              <div className="flex items-center justify-center h-16">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span className="ml-2">Loading variables...</span>
              </div>
            ) : (
              fullMessage
            )}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="text-sm space-y-1">
        <div className="flex justify-between">
          <span>Characters:</span>
          <span className={characterCount > 160 ? 'text-orange-500' : 'text-gray-600'}>
            {characterCount}
          </span>
        </div>
        <div className="flex justify-between">
          <span>SMS Segments:</span>
          <span className={smsSegments > 1 ? 'text-orange-500' : 'text-gray-600'}>
            {smsSegments}
          </span>
        </div>
        <div className="flex justify-between">
          <span>Est. Cost:</span>
          <span className="text-gray-600">${(smsSegments * 0.01).toFixed(2)}</span>
        </div>
      </div>

      {/* Send Button */}
      <button
        onClick={onSendTest}
        disabled={!realPreviewText || isLoading}
        className="w-full py-2 px-4 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        📤 Send Test SMS
      </button>
      
      {realPreviewText && (
        <p className="text-xs text-gray-500 text-center">
          Test SMS will be sent to your registered phone number
        </p>
      )}
    </div>
  );
}
