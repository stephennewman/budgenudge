'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';

export interface CalendarBill {
  key: string;
  name: string;
  amount: number;
  date: string;
  isPaid: boolean;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function BillsCalendar({ monthKey, bills }: { monthKey: string; bills: CalendarBill[] }) {
  const [year, month] = monthKey.split('-').map(Number);
  const firstWeekday = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const todayDay = today.getFullYear() === year && today.getMonth() + 1 === month ? today.getDate() : null;

  const byDay: Record<number, CalendarBill[]> = {};
  for (const bill of bills) {
    if (!bill.date.startsWith(monthKey)) continue;
    const day = Number(bill.date.slice(8, 10));
    (byDay[day] ||= []).push(bill);
  }

  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const selectedBills = selectedDay ? byDay[selectedDay] || [] : [];

  const cells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7) cells.push(null);

  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-7 text-center text-xs font-medium text-gray-500 border-b bg-gray-50">
        {WEEKDAYS.map((d, i) => <div key={i} className="py-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-100">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="bg-white min-h-[44px] sm:min-h-[88px]" />;
          const dayBills = byDay[day] || [];
          const total = dayBills.reduce((s, b) => s + b.amount, 0);
          const isSelected = selectedDay === day;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedDay(isSelected ? null : day)}
              className={`bg-white min-h-[44px] sm:min-h-[88px] p-1 text-left flex flex-col gap-0.5 min-w-0 hover:bg-gray-50 ${isSelected ? 'ring-2 ring-inset ring-green-600' : ''}`}
            >
              <span className={`text-xs ${todayDay === day ? 'bg-green-600 text-white rounded-full w-5 h-5 flex items-center justify-center' : 'text-gray-500'}`}>
                {day}
              </span>
              {dayBills.length > 0 && (
                <>
                  <span className="sm:hidden flex flex-wrap gap-0.5">
                    {dayBills.map(b => (
                      <span key={b.key} className={`w-1.5 h-1.5 rounded-full ${b.isPaid ? 'bg-green-600' : 'bg-amber-500'}`} />
                    ))}
                  </span>
                  <span className="hidden sm:flex flex-col gap-0.5 min-w-0">
                    {dayBills.slice(0, 2).map(b => (
                      <span
                        key={b.key}
                        className={`truncate text-[10px] px-1 rounded ${b.isPaid ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}
                      >
                        {b.name}
                      </span>
                    ))}
                    {dayBills.length > 2 && <span className="text-[10px] text-gray-400">+{dayBills.length - 2} more</span>}
                  </span>
                  <span className="mt-auto text-[10px] font-semibold text-gray-700 truncate">${Math.round(total)}</span>
                </>
              )}
            </button>
          );
        })}
      </div>
      <div className="flex gap-4 px-4 py-2 text-xs text-gray-500 border-t">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-600" />Paid</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" />Upcoming</span>
      </div>
      {selectedDay && (
        <div className="border-t divide-y divide-gray-100">
          {selectedBills.length === 0 ? (
            <p className="px-4 py-3 text-sm text-gray-500">No bills on this day.</p>
          ) : selectedBills.map(b => (
            <div key={b.key} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="flex items-center gap-2 min-w-0">
                <span className={`w-2 h-2 flex-shrink-0 rounded-full ${b.isPaid ? 'bg-green-600' : 'bg-amber-500'}`} />
                <span className="truncate">{b.name}</span>
              </span>
              <span className="font-semibold flex-shrink-0">${b.amount.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
