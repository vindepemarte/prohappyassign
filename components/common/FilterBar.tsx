import React, { useState, useEffect } from 'react';
import DateRangePicker from './DateRangePicker';

export type TimeFilterType = 'week' | 'month' | 'custom';

export interface TimeFilter {
  type: TimeFilterType;
  startDate?: Date;
  endDate?: Date;
}

export interface EarningsDisplay {
  gbp: number;
  inr: number;
  profit?: number;
  toPay?: number;
}

interface FilterBarProps {
  onFilterChange: (filter: TimeFilter) => void;
  onDateRangeChange: (startDate: Date, endDate: Date) => void;
  currentFilter: TimeFilter;
  earnings?: EarningsDisplay;
  showEarnings?: boolean;
  showProfit?: boolean;
  className?: string;
}

const FilterBar: React.FC<FilterBarProps> = ({
  onFilterChange,
  onDateRangeChange,
  currentFilter,
  earnings,
  showEarnings = false,
  showProfit = false,
  className = ''
}) => {
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({
    start: null,
    end: null
  });

  // Calculate default date ranges
  const getWeekRange = () => {
    const now = new Date();
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
    startOfWeek.setHours(0, 0, 0, 0);
    
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6); // End of current week (Saturday)
    endOfWeek.setHours(23, 59, 59, 999);
    
    return { start: startOfWeek, end: endOfWeek };
  };

  const getMonthRange = () => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    
    return { start: startOfMonth, end: endOfMonth };
  };

  const handleFilterClick = (type: TimeFilterType) => {
    let filter: TimeFilter = { type };
    
    if (type === 'week') {
      const { start, end } = getWeekRange();
      filter = { type, startDate: start, endDate: end };
      setShowDatePicker(false);
    } else if (type === 'month') {
      const { start, end } = getMonthRange();
      filter = { type, startDate: start, endDate: end };
      setShowDatePicker(false);
    } else if (type === 'custom') {
      setShowDatePicker(true);
      // Don't call onFilterChange yet, wait for date selection
      return;
    }
    
    onFilterChange(filter);
  };

  const handleDateRangeSelect = (startDate: Date, endDate: Date) => {
    setDateRange({ start: startDate, end: endDate });
    setShowDatePicker(false);
    
    const filter: TimeFilter = {
      type: 'custom',
      startDate,
      endDate
    };
    
    onFilterChange(filter);
    onDateRangeChange(startDate, endDate);
  };

  const handleDatePickerClose = () => {
    setShowDatePicker(false);
    // If no custom range was selected, revert to previous filter
    if (currentFilter.type === 'custom' && !dateRange.start) {
      handleFilterClick('month'); // Default fallback
    }
  };

  const formatDateRange = (filter: TimeFilter) => {
    if (!filter.startDate || !filter.endDate) return '';
    
    const start = filter.startDate.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short' 
    });
    const end = filter.endDate.toLocaleDateString('en-GB', { 
      day: '2-digit', 
      month: 'short',
      year: 'numeric'
    });
    
    return `${start} - ${end}`;
  };

  const formatEarnings = (earnings: EarningsDisplay) => {
    if (showProfit && earnings.profit !== undefined && earnings.toPay !== undefined) {
      return `Profit £${earnings.profit.toFixed(2)} / To Give £${earnings.toPay.toFixed(2)}`;
    } else {
      return `£${earnings.gbp.toFixed(2)} / ${earnings.inr.toLocaleString('en-IN', { maximumFractionDigits: 2 })} Indian Rupee`;
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow-sm border p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleFilterClick('week')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentFilter.type === 'week'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Week
          </button>
          <button
            onClick={() => handleFilterClick('month')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentFilter.type === 'month'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => handleFilterClick('custom')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              currentFilter.type === 'custom'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            Custom Range
          </button>
        </div>

        {/* Date Range Display and Earnings */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 text-sm">
          {currentFilter.startDate && currentFilter.endDate && (
            <div className="text-gray-600 font-medium">
              {formatDateRange(currentFilter)}
            </div>
          )}
          
          {showEarnings && earnings && (
            <div className={`px-3 py-2 rounded-lg font-semibold ${
              showProfit 
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-blue-50 text-blue-800 border border-blue-200'
            }`}>
              {formatEarnings(earnings)}
            </div>
          )}
        </div>
      </div>

      {/* Date Range Picker */}
      {showDatePicker && (
        <div className="mt-4 pt-4 border-t">
          <DateRangePicker
            onDateRangeSelect={handleDateRangeSelect}
            onClose={handleDatePickerClose}
            initialStartDate={dateRange.start}
            initialEndDate={dateRange.end}
          />
        </div>
      )}
    </div>
  );
};

export default FilterBar;