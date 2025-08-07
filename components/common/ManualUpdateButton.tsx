import React, { useState } from 'react';
import AppUpdateService from '../../services/appUpdateService';

const ManualUpdateButton: React.FC = () => {
  const [isChecking, setIsChecking] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleCheckUpdates = async () => {
    setIsChecking(true);
    try {
      const updateInfo = await AppUpdateService.checkForUpdates();
      if (updateInfo.available) {
        const shouldUpdate = confirm('An update is available! Would you like to apply it now?');
        if (shouldUpdate) {
          AppUpdateService.applyUpdate();
        }
      } else {
        alert('You are running the latest version!');
      }
    } catch (error) {
      console.error('Error checking for updates:', error);
      alert('Error checking for updates. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  const handleClearCache = async () => {
    const shouldClear = confirm(
      'This will clear all cached data and reload the app. You may need to log in again. Continue?'
    );
    
    if (shouldClear) {
      setIsClearing(true);
      try {
        await AppUpdateService.clearCacheAndReload();
      } catch (error) {
        console.error('Error clearing cache:', error);
        setIsClearing(false);
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">App Updates</h3>
          <p className="text-xs text-gray-600 mt-1">Keep your app up to date</p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={handleCheckUpdates}
            disabled={isChecking}
            className="px-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isChecking ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white inline" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Checking...
              </>
            ) : (
              'Check Updates'
            )}
          </button>
          <button
            onClick={handleClearCache}
            disabled={isClearing}
            className="px-3 py-2 bg-gray-600 text-white text-xs font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isClearing ? 'Clearing...' : 'Clear Cache'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ManualUpdateButton;