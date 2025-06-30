'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { createSupabaseClient } from '@/utils/supabase/client';

interface AnalysisCard {
  id: string;
  title: string;
  content: React.ReactNode;
  width: number; // grid units wide
  height: number; // grid units tall
  position: { x: number; y: number }; // grid position
}

interface MerchantData {
  merchant_name: string;
  total_transactions: number;
  total_spending: number;
  avg_weekly_spending: number;
}

interface MerchantAnalytics {
  merchant: string;
  totalTransactions: number;
  totalSpending: number;
  weeklySpending: number;
  rank: number;
}

export default function AnalysisPage() {
  const [merchantAnalytics, setMerchantAnalytics] = useState<MerchantAnalytics[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const supabase = createSupabaseClient();

  // Fetch cached merchant analytics
  useEffect(() => {
    async function fetchMerchantAnalytics() {
      try {
        setIsLoadingTransactions(true);
        const { data: { session } } = await supabase.auth.getSession();
        console.log('Analysis - Session check:', !!session);
        if (!session) {
          console.log('Analysis - No session found');
          return;
        }

        console.log('Analysis - Fetching cached merchant analytics...');
        console.log('Analysis - Auth token preview:', session.access_token?.substring(0, 20) + '...');
        
        const response = await fetch('/api/merchant-analytics?limit=10&sortBy=total_transactions', {
          headers: {
            'Authorization': `Bearer ${session.access_token}`
          }
        });
        
        console.log('Analysis - Response status:', response.status);
        console.log('Analysis - Response headers:', Object.fromEntries(response.headers.entries()));
        
        const data = await response.json();
        console.log('Analysis - Merchant Analytics Response:', { 
          ok: response.ok, 
          status: response.status,
          dataKeys: Object.keys(data),
          merchantCount: data.merchants?.length,
          summary: data.summary,
          error: data.error
        });
        
        if (response.ok && data.merchants) {
          console.log('Analysis - Using cached merchant analytics:', data.merchants.length);
          if (data.merchants.length > 0) {
            console.log('Analysis - Sample cached merchant:', data.merchants[0]);
          }
          
          // Convert cached data to the format expected by the component
          const formattedAnalytics = data.merchants.map((merchant: MerchantData, index: number) => ({
            merchant: merchant.merchant_name,
            totalTransactions: merchant.total_transactions,
            totalSpending: merchant.total_spending,
            weeklySpending: merchant.avg_weekly_spending,
            rank: index + 1
          }));
          
          console.log('Analysis - Formatted analytics:', formattedAnalytics);
          setMerchantAnalytics(formattedAnalytics);
          
        } else if (!response.ok) {
          console.error('Analysis - API HTTP Error:', {
            status: response.status,
            statusText: response.statusText,
            responseData: data
          });
        } else if (!data.merchants) {
          console.error('Analysis - No merchants in response:', data);
        } else {
          console.error('Analysis - Unknown error:', data);
        }
      } catch (error) {
        console.error('Analysis - Error fetching merchant analytics:', error);
      } finally {
        setIsLoadingTransactions(false);
      }
    }

    fetchMerchantAnalytics();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // No longer needed - using cached analytics from database

  const TopMerchantActivity = () => {
    if (isLoadingTransactions) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <div className="animate-pulse">Loading merchant data...</div>
          <div className="text-xs mt-2">Fetching cached analytics from database</div>
        </div>
      );
    }

    if (merchantAnalytics.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <div>No merchant data available</div>
          <div className="text-xs mt-2">
            Check console for debugging info or ensure transactions are stored in database
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="text-xs text-muted-foreground mb-2">
          Top merchants by transaction volume
        </div>
        <div className="space-y-2">
          {merchantAnalytics.map((merchant) => (
            <div
              key={merchant.merchant}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-medium">
                  {merchant.rank}
                </div>
                <div>
                  <div className="font-medium text-sm truncate max-w-[120px]">
                    {merchant.merchant}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {merchant.totalTransactions} transactions
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="font-medium text-sm">
                  ${merchant.weeklySpending.toFixed(0)}/wk
                </div>
                <div className="text-xs text-muted-foreground">
                  ${merchant.totalSpending.toFixed(0)} total
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const [cards, setCards] = useState<AnalysisCard[]>([
    {
      id: 'card-1',
      title: 'Top 10 Weekly Merchant Activity',
      content: null, // Will be rendered dynamically
      width: 2,
      height: 2,
      position: { x: 0, y: 0 }
    },
    {
      id: 'card-2', 
      title: 'Category Breakdown',
      content: <div className="text-center py-8 text-muted-foreground">Pie chart placeholder</div>,
      width: 1,
      height: 1,
      position: { x: 2, y: 0 }
    },
    {
      id: 'card-3',
      title: 'Monthly Trends',
      content: <div className="text-center py-8 text-muted-foreground">Line chart placeholder</div>,
      width: 3,
      height: 2,
      position: { x: 0, y: 1 }
    }
  ]);

  // Helper function to get card content dynamically
  const getCardContent = (cardId: string) => {
    switch (cardId) {
      case 'card-1':
        return <TopMerchantActivity />;
      default:
        return cards.find(c => c.id === cardId)?.content;
    }
  };

  const GRID_COLS = 6; // Number of grid columns
  const GRID_ROWS = 8; // Number of grid rows
  const [draggedCard, setDraggedCard] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<{ x: number; y: number } | null>(null);

  const isPositionAvailable = (x: number, y: number, width: number, height: number, excludeCardId?: string) => {
    if (x + width > GRID_COLS || y + height > GRID_ROWS || x < 0 || y < 0) return false;
    
    for (let checkY = y; checkY < y + height; checkY++) {
      for (let checkX = x; checkX < x + width; checkX++) {
        const occupyingCard = cards.find(card => 
          card.id !== excludeCardId &&
          checkX >= card.position.x && 
          checkX < card.position.x + card.width &&
          checkY >= card.position.y && 
          checkY < card.position.y + card.height
        );
        if (occupyingCard) return false;
      }
    }
    return true;
  };

  const handleDragStart = (cardId: string) => {
    setDraggedCard(cardId);
  };

  const handleDragEnd = () => {
    setDraggedCard(null);
    setDragOverPosition(null);
  };

  const handleGridDrop = (e: React.DragEvent, gridX: number, gridY: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedCard) {
      const card = cards.find(c => c.id === draggedCard);
      if (card && isPositionAvailable(gridX, gridY, card.width, card.height, draggedCard)) {
        setCards(prev => prev.map(c => 
          c.id === draggedCard 
            ? { ...c, position: { x: gridX, y: gridY } }
            : c
        ));
      }
    }
    
    setDraggedCard(null);
    setDragOverPosition(null);
  };

  const handleGridDragOver = (e: React.DragEvent, gridX: number, gridY: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggedCard) {
      const card = cards.find(c => c.id === draggedCard);
      if (card && isPositionAvailable(gridX, gridY, card.width, card.height, draggedCard)) {
        setDragOverPosition({ x: gridX, y: gridY });
      }
    }
  };

  const handleResize = (cardId: string, newWidth: number, newHeight: number) => {
    const card = cards.find(c => c.id === cardId);
    if (card && isPositionAvailable(card.position.x, card.position.y, newWidth, newHeight, cardId)) {
      setCards(prev => prev.map(c => 
        c.id === cardId 
          ? { ...c, width: Math.max(1, newWidth), height: Math.max(1, newHeight) }
          : c
      ));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analysis Dashboard</h1>
            <p className="text-muted-foreground">
              Drag and resize cards to customize your analysis view
            </p>
          </div>
          <div className="text-sm text-muted-foreground">
            {cards.length} analysis cards
          </div>
        </div>
      </div>

      {/* Grid-based Layout */}
      <div 
        className="relative border-2 border-dashed border-gray-200 rounded-lg p-4"
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${GRID_COLS}, 1fr)`,
          gridTemplateRows: `repeat(${GRID_ROWS}, 120px)`,
          gap: '8px',
          minHeight: '800px'
        }}
      >
        {/* Grid drop zones */}
        {Array.from({ length: GRID_ROWS }, (_, y) =>
          Array.from({ length: GRID_COLS }, (_, x) => (
            <div
              key={`grid-${x}-${y}`}
              className={`border border-gray-100 rounded transition-all ${
                dragOverPosition?.x === x && dragOverPosition?.y === y
                  ? 'bg-blue-50 border-blue-300'
                  : ''
              }`}
              onDragOver={(e) => handleGridDragOver(e, x, y)}
              onDrop={(e) => handleGridDrop(e, x, y)}
              style={{
                gridColumn: x + 1,
                gridRow: y + 1,
              }}
            />
          ))
        )}

        {/* Cards positioned on grid */}
        {cards.map((card) => (
          <div
            key={card.id}
            className="relative"
            style={{
              gridColumn: `${card.position.x + 1} / span ${card.width}`,
              gridRow: `${card.position.y + 1} / span ${card.height}`,
              zIndex: draggedCard === card.id ? 50 : 10,
            }}
          >
            <Card
              className={`h-full cursor-move hover:shadow-lg transition-all duration-200 relative ${
                draggedCard === card.id ? 'opacity-50' : ''
              }`}
              draggable
              onDragStart={() => handleDragStart(card.id)}
              onDragEnd={handleDragEnd}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-lg font-medium">{card.title}</CardTitle>
                
                {/* Card dimensions indicator */}
                <div className="text-xs text-muted-foreground">
                  {card.width}×{card.height}
                </div>
              </CardHeader>
              
              <CardContent className="flex-1 relative">
                {getCardContent(card.id)}
              </CardContent>

              {/* Corner resize handles */}
              <div className="absolute -bottom-2 -right-2 w-4 h-4 bg-blue-500 rounded-full cursor-se-resize opacity-0 hover:opacity-100 transition-opacity"
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const startWidth = card.width;
                  const startHeight = card.height;
                  
                  const handleMouseMove = (e: MouseEvent) => {
                    const deltaX = e.clientX - startX;
                    const deltaY = e.clientY - startY;
                    
                    // Convert pixel movement to grid units (rough calculation)
                    const newWidth = Math.max(1, startWidth + Math.round(deltaX / 120));
                    const newHeight = Math.max(1, startHeight + Math.round(deltaY / 120));
                    
                    handleResize(card.id, newWidth, newHeight);
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
              />
            </Card>
          </div>
        ))}
      </div>

      {/* Add Card Button */}
      <div className="flex justify-center">
        <button 
          className="px-4 py-2 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 transition-colors text-muted-foreground hover:text-foreground"
          onClick={() => {
            // Find first available position
            let x = 0, y = 0;
            while (!isPositionAvailable(x, y, 2, 1)) {
              x++;
              if (x + 2 > GRID_COLS) {
                x = 0;
                y++;
                if (y >= GRID_ROWS) break;
              }
            }
            
            const newCard: AnalysisCard = {
              id: `card-${Date.now()}`,
              title: `Analysis ${cards.length + 1}`,
              content: <div className="text-center py-8 text-muted-foreground">New analysis card</div>,
              width: 2,
              height: 1,
              position: { x, y }
            };
            setCards(prev => [...prev, newCard]);
          }}
        >
          + Add Analysis Card
        </button>
      </div>
    </div>
  );
} 