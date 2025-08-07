import React, { useState, useEffect } from 'react';
import AppUpdateService from '../../services/appUpdateService';

const UpdateNotification: React.FC = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    // Listen for update availability
    const handleUpdateAvailable = (event: CustomEvent) => {
      setUpdateAvailable(true);
    };

    window.addEventListener('app-update-available', handleUpdateAvailable as EventListener);

    // Check for updates on component mount
    AppUpdateService.checkForUpdates().then((updateInfo) => {
      if (updateInfo.available) {
        setUpdateAvailable(true);
      }
    });

    return () => {
      window.removeEventListener('app-update-available', handleUpdateAvailable as EventListener);
    };
  }, []);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      AppUpdateService.applyUpdate();
      // The page will reload automatically
    } catch (error) {
      console.error('Error applying update:', error);
      setIsUpdating(false);
    }
  };

  const handleDismiss = () => {
    setUpdateAvailable(false);
  };

  if (!updateAvailable) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-blue-600 text-white p-4 rounded-xl shadow-lg z-50 max-w-sm">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          <svg className="w-6 h-6 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-sm">Update Available</h4>
          <p className="text-xs text-blue-100 mt-1">
            A new version of the app is ready to install.
          </p>
          <div className="flex space-x-2 mt-3">
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="bg-white text-blue-600 px-3 py-1 rounded-lg text-xs font-medium hover:bg-blue-50 transition-colors disabled:opacity-50"
            >
              {isUpdating ? 'Updating...' : 'Update Now'}
            </button>
            <button
              onClick={handleDismiss}
              className="text-blue-200 hover:text-white px-3 py-1 rounded-lg text-xs transition-colors"
            >
              Later
            </button>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-blue-200 hover:text-white transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default UpdateNotification;