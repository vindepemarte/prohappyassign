import React from 'react';
import { PricingBreakdown as PricingBreakdownType, UrgencyLevel } from '../../types';

interface PricingBreakdownProps {
  breakdown: PricingBreakdownType;
  showDetails?: boolean;
  className?: string;
}

const PricingBreakdown: React.FC<PricingBreakdownProps> = ({ 
  breakdown, 
  showDetails = true, 
  className = '' 
}) => {
  const getUrgencyColor = (level: UrgencyLevel) => {
    switch (level) {
      case 'rush': return '#dc2626';
      case 'urgent': return '#ea580c';
      case 'moderate': return '#d97706';
      default: return '#059669';
    }
  };
  
  const getUrgencyDisplayText = (level: UrgencyLevel) => {
    switch (level) {
      case 'rush': return 'Rush Delivery';
      case 'urgent': return 'Urgent Delivery';
      case 'moderate': return 'Moderate Priority';
      default: return 'Standard Delivery';
    }
  };

  const urgencyColor = getUrgencyColor(breakdown.urgencyLevel);
  const urgencyText = getUrgencyDisplayText(breakdown.urgencyLevel);

  return (
    <div className={`bg-blue-50 rounded-lg p-4 border border-blue-200 ${className}`}>
      <div className="text-center">
        <div className="text-lg font-semibold text-gray-700 mb-2">
          Pricing Breakdown
        </div>
        
        {showDetails && (
          <div className="space-y-2 text-sm text-gray-600 mb-3">
            {/* Agent-specific pricing breakdown */}
            {breakdown.agentInfo && (
              <>
                <div className="text-xs text-blue-700 font-medium mb-2">
                  Pricing by {breakdown.agentInfo.name}
                </div>
                <div className="flex justify-between items-center">
                  <span>Base Cost ({breakdown.wordCount} words):</span>
                  <span className="font-medium">£{breakdown.basePrice.toFixed(2)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>Agent Fee ({breakdown.agentInfo.feePercentage}%):</span>
                  <span className="font-medium">£{breakdown.agentInfo.agentFee.toFixed(2)}</span>
                </div>
                <div className="text-xs text-gray-500">
                  Rate: £{breakdown.agentInfo.baseRate} per 500 words
                </div>
              </>
            )}
            
            {!breakdown.agentInfo && (
              <div className="flex justify-between items-center">
                <span>Base Price:</span>
                <span className="font-medium">£{breakdown.basePrice.toFixed(2)}</span>
              </div>
            )}
            
            {breakdown.deadlineCharge > 0 && (
              <div className="flex justify-between items-center">
                <span>Deadline Charge:</span>
                <span className="font-medium">£{breakdown.deadlineCharge.toFixed(2)}</span>
              </div>
            )}
            
            <hr className="border-blue-200" />
          </div>
        )}
        
        <div className="flex justify-between items-center text-lg font-bold">
          <span className="text-gray-700">Total Price:</span>
          <span className="text-blue-600">£{breakdown.totalPrice.toFixed(2)}</span>
        </div>
        
        {breakdown.urgencyLevel !== 'normal' && (
          <div className="mt-3 flex items-center justify-center space-x-2">
            <div 
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: urgencyColor }}
            />
            <span 
              className="text-sm font-medium"
              style={{ color: urgencyColor }}
            >
              {urgencyText}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default PricingBreakdown;