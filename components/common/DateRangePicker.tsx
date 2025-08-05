import React, { useState, useEffect } from 'react';

interface DateRangePickerProps {
  onDateRangeSelect: (startDate: Date, endDate: Date) => void;
  onClose: () => void;
  initialStartDate?: Date | null;
  initialEndDate?: Date | null;
  minDate?: Date;
  maxDate?: Date;
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({
  onDateRangeSelect,
  onClose,
  initialStartDate = null,
  initialEndDate = null,
  minDate,
  maxDate = new Date()
}) => {
  const [startDate, setStartDate] = useState<string>(
    initialStartDate ? initialStartDate.toISOString().split('T')[0] : ''
  );
  const [endDate, setEndDate] = useState<string>(
    initialEndDate ? initialEndDate.toISOString().split('T')[0] : ''
  );
  const [error, setError] = useState<string>('');

  // Format date for input field (YYYY-MM-DD)
  const formatDateForInput = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  // Get min and max date strings for input validation
  const minDateStr = minDate ? formatDateForInput(minDate) : '2020-01-01';
  const maxDateStr = formatDateForInput(maxDate);

  const validateDateRange = (start: string, end: string): string => {
    if (!start || !end) {
      return 'Please select both start and end dates';
    }

    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    if (startDateObj > endDateObj) {
      return 'Start date must be before end date';
    }

    if (minDate && startDateObj < minDate) {
      return `Start date cannot be before ${minDate.toLocaleDateString()}`;
    }

    if (endDateObj > maxDate) {
      return `End date cannot be after ${maxDate.toLocaleDateString()}`;
    }

    // Check if date range is too large (more than 1 year)
    const daysDifference = Math.ceil((endDateObj.getTime() - startDateObj.getTime()) / (1000 * 60 * 60 * 24));
    if (daysDifference > 365) {
      return 'Date range cannot exceed 1 year';
    }

    return '';
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStartDate = e.target.value;
    setStartDate(newStartDate);
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }

    // Auto-adjust end date if it's before the new start date
    if (endDate && newStartDate && new Date(newStartDate) > new Date(endDate)) {
      const adjustedEndDate = new Date(newStartDate);
      adjustedEndDate.setDate(adjustedEndDate.getDate() + 7); // Add 7 days
      if (adjustedEndDate <= maxDate) {
        setEndDate(formatDateForInput(adjustedEndDate));
      }
    }
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEndDate = e.target.value;
    setEndDate(newEndDate);
    
    // Clear error when user starts typing
    if (error) {
      setError('');
    }
  };

  const handleApply = () => {
    const validationError = validateDateRange(startDate, endDate);
    
    if (validationError) {
      setError(validationError);
      return;
    }

    const startDateObj = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    // Set time to start and end of day
    startDateObj.setHours(0, 0, 0, 0);
    endDateObj.setHours(23, 59, 59, 999);

    onDateRangeSelect(startDateObj, endDateObj);
  };

  const handleQuickSelect = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - days);
    
    setStartDate(formatDateForInput(start));
    setEndDate(formatDateForInput(end));
    setError('');
  };

  const isApplyDisabled = !startDate || !endDate || !!error;

  return (
    <div className="bg-white rounded-2xl p-6 border-2 border-gray-200 shadow-xl animate-slideInFromTop">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800">Select Date Range</h3>
        </div>
        <button
          onClick={onClose}
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
          aria-label="Close date picker"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Quick Select Buttons */}
      <div className="mb-6">
        <p className="text-sm font-semibold text-gray-700 mb-3">Quick Select:</p>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleQuickSelect(7)}
            className="px-4 py-2 text-sm bg-gradient-to-r from-blue-50 to-indigo-50 text-blue-700 rounded-xl hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 border border-blue-200 font-medium"
          >
            📅 Last 7 days
          </button>
          <button
            onClick={() => handleQuickSelect(30)}
            className="px-4 py-2 text-sm bg-gradient-to-r from-purple-50 to-pink-50 text-purple-700 rounded-xl hover:from-purple-100 hover:to-pink-100 transition-all duration-200 border border-purple-200 font-medium"
          >
            📊 Last 30 days
          </button>
          <button
            onClick={() => handleQuickSelect(90)}
            className="px-4 py-2 text-sm bg-gradient-to-r from-green-50 to-emerald-50 text-green-700 rounded-xl hover:from-green-100 hover:to-emerald-100 transition-all duration-200 border border-green-200 font-medium"
          >
            📈 Last 90 days
          </button>
        </div>
      </div>

      {/* Date Inputs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div>
          <label htmlFor="start-date" className="block text-sm font-semibold text-gray-700 mb-3">
            Start Date
          </label>
          <input
            id="start-date"
            type="date"
            value={startDate}
            onChange={handleStartDateChange}
            min={minDateStr}
            max={maxDateStr}
            className="form-input w-full px-4 py-3 rounded-xl focus:outline-none transition-all duration-200"
          />
        </div>
        <div>
          <label htmlFor="end-date" className="block text-sm font-semibold text-gray-700 mb-3">
            End Date
          </label>
          <input
            id="end-date"
            type="date"
            value={endDate}
            onChange={handleEndDateChange}
            min={startDate || minDateStr}
            max={maxDateStr}
            className="form-input w-full px-4 py-3 rounded-xl focus:outline-none transition-all duration-200"
          />
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 error-message">
          <div className="p-4 bg-gradient-to-r from-red-50 to-pink-50 border-2 border-red-200 rounded-xl">
            <div className="flex items-center space-x-3">
              <div className="flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex justify-end gap-3">
        <button
          onClick={onClose}
          className="px-6 py-3 text-sm font-semibold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all duration-200 border border-gray-200"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={isApplyDisabled}
          className={`
            px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-200 btn-enhanced
            ${isApplyDisabled
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed border border-gray-300'
              : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg hover:shadow-xl border border-blue-600'
            }
          `}
        >
          {isApplyDisabled ? 'Select Dates' : '✨ Apply Range'}
        </button>
      </div>
    </div>
  );
};

export default DateRangePicker;