import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Shield, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertTriangle, 
  Info, 
  RefreshCw,
  Home,
  ArrowLeft,
  HelpCircle
} from 'lucide-react';

interface PermissionDeniedProps {
  title?: string;
  message?: string;
  requiredPermission?: string;
  userRole?: string;
  allowedRoles?: string[];
  showContactSupport?: boolean;
  showGoBack?: boolean;
  showGoHome?: boolean;
  onGoBack?: () => void;
  onContactSupport?: () => void;
}

export const PermissionDenied: React.FC<PermissionDeniedProps> = ({
  title = 'Access Denied',
  message,
  requiredPermission,
  userRole,
  allowedRoles = [],
  showContactSupport = true,
  showGoBack = true,
  showGoHome = true,
  onGoBack,
  onContactSupport
}) => {
  const defaultMessage = message || 
    `You don't have permission to access this feature. ${
      requiredPermission ? `Required permission: ${requiredPermission}` : ''
    }`;

  const handleGoBack = () => {
    if (onGoBack) {
      onGoBack();
    } else {
      window.history.back();
    }
  };

  const handleGoHome = () => {
    window.location.href = '/';
  };

  const handleContactSupport = () => {
    if (onContactSupport) {
      onContactSupport();
    } else {
      // Default support action - could open modal or redirect
      console.log('Contact support requested');
    }
  };

  return (
    <Card className=\"max-w-md mx-auto mt-8\">
      <CardHeader>
        <CardTitle className=\"flex items-center gap-2 text-orange-600\">
          <Shield className=\"h-5 w-5\" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className=\"space-y-4\">
        <Alert>
          <Lock className=\"h-4 w-4\" />
          <AlertDescription>{defaultMessage}</AlertDescription>
        </Alert>

        {userRole && allowedRoles.length > 0 && (
          <div className=\"text-sm text-gray-600 p-3 bg-gray-50 rounded\">
            <div className=\"mb-1\">
              <strong>Your role:</strong> {userRole}
            </div>
            <div>
              <strong>Required roles:</strong> {allowedRoles.join(', ')}
            </div>
          </div>
        )}

        <div className=\"flex flex-col gap-2\">
          {showGoBack && (
            <Button onClick={handleGoBack} variant=\"outline\" className=\"flex items-center gap-2\">
              <ArrowLeft className=\"h-4 w-4\" />
              Go Back
            </Button>
          )}
          
          {showGoHome && (
            <Button onClick={handleGoHome} variant=\"outline\" className=\"flex items-center gap-2\">
              <Home className=\"h-4 w-4\" />
              Go to Dashboard
            </Button>
          )}
          
          {showContactSupport && (
            <Button onClick={handleContactSupport} variant=\"outline\" className=\"flex items-center gap-2\">
              <HelpCircle className=\"h-4 w-4\" />
              Contact Support
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

interface FeatureUnavailableProps {
  title?: string;
  message?: string;
  reason?: 'maintenance' | 'upgrade' | 'configuration' | 'temporary';
  estimatedTime?: string;
  showRetry?: boolean;
  onRetry?: () => void;
}

export const FeatureUnavailable: React.FC<FeatureUnavailableProps> = ({
  title = 'Feature Unavailable',
  message,
  reason = 'temporary',
  estimatedTime,
  showRetry = true,
  onRetry
}) => {
  const getReasonMessage = () => {
    switch (reason) {
      case 'maintenance':
        return 'This feature is temporarily unavailable due to scheduled maintenance.';
      case 'upgrade':
        return 'This feature is being upgraded and will be available soon.';
      case 'configuration':
        return 'This feature requires additional configuration by your administrator.';
      default:
        return 'This feature is temporarily unavailable.';
    }
  };

  const defaultMessage = message || getReasonMessage();

  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <Card className=\"max-w-md mx-auto mt-8\">
      <CardHeader>
        <CardTitle className=\"flex items-center gap-2 text-blue-600\">
          <Info className=\"h-5 w-5\" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className=\"space-y-4\">
        <Alert>
          <AlertTriangle className=\"h-4 w-4\" />
          <AlertDescription>{defaultMessage}</AlertDescription>
        </Alert>

        {estimatedTime && (
          <div className=\"text-sm text-gray-600 p-3 bg-blue-50 rounded\">
            <strong>Estimated availability:</strong> {estimatedTime}
          </div>
        )}

        {showRetry && (
          <Button onClick={handleRetry} className=\"w-full flex items-center gap-2\">
            <RefreshCw className=\"h-4 w-4\" />
            Try Again
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

interface LimitedViewProps {
  title?: string;
  message?: string;
  availableFeatures?: string[];
  restrictedFeatures?: string[];
  upgradeMessage?: string;
  showUpgradeButton?: boolean;
  onUpgrade?: () => void;
  children?: React.ReactNode;
}

export const LimitedView: React.FC<LimitedViewProps> = ({
  title = 'Limited Access',
  message = 'You have limited access to this feature.',
  availableFeatures = [],
  restrictedFeatures = [],
  upgradeMessage,
  showUpgradeButton = false,
  onUpgrade,
  children
}) => {
  return (
    <div className=\"space-y-4\">
      <Alert>
        <EyeOff className=\"h-4 w-4\" />
        <AlertDescription>
          <div className=\"font-medium mb-2\">{title}</div>
          <div>{message}</div>
        </AlertDescription>
      </Alert>

      {(availableFeatures.length > 0 || restrictedFeatures.length > 0) && (
        <Card>
          <CardContent className=\"pt-6\">
            {availableFeatures.length > 0 && (
              <div className=\"mb-4\">
                <h4 className=\"font-medium text-green-700 mb-2 flex items-center gap-2\">
                  <Eye className=\"h-4 w-4\" />
                  Available to you:
                </h4>
                <ul className=\"text-sm text-green-600 space-y-1\">
                  {availableFeatures.map((feature, index) => (
                    <li key={index}>• {feature}</li>
                  ))}
                </ul>
              </div>
            )}

            {restrictedFeatures.length > 0 && (
              <div>
                <h4 className=\"font-medium text-gray-700 mb-2 flex items-center gap-2\">
                  <EyeOff className=\"h-4 w-4\" />
                  Restricted:
                </h4>
                <ul className=\"text-sm text-gray-500 space-y-1\">
                  {restrictedFeatures.map((feature, index) => (
                    <li key={index}>• {feature}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {upgradeMessage && (
        <Alert>
          <Info className=\"h-4 w-4\" />
          <AlertDescription>
            {upgradeMessage}
            {showUpgradeButton && onUpgrade && (
              <Button 
                onClick={onUpgrade} 
                size=\"sm\" 
                className=\"ml-2\"
              >
                Upgrade Access
              </Button>
            )}
          </AlertDescription>
        </Alert>
      )}

      {children && (
        <div className=\"opacity-75\">
          {children}
        </div>
      )}
    </div>
  );
};

interface DataMaskedProps {
  reason?: string;
  showPartialData?: boolean;
  partialDataMessage?: string;
  children?: React.ReactNode;
}

export const DataMasked: React.FC<DataMaskedProps> = ({
  reason = 'You don\\'t have permission to view this sensitive information.',
  showPartialData = false,
  partialDataMessage = 'Some information has been hidden for security.',
  children
}) => {
  return (
    <div className=\"space-y-3\">
      <Alert variant=\"destructive\">
        <Shield className=\"h-4 w-4\" />
        <AlertDescription>{reason}</AlertDescription>
      </Alert>

      {showPartialData && children && (
        <>
          <Alert>
            <Info className=\"h-4 w-4\" />
            <AlertDescription>{partialDataMessage}</AlertDescription>
          </Alert>
          <div className=\"filter blur-sm pointer-events-none select-none\">
            {children}
          </div>
        </>
      )}
    </div>
  );
};

interface NetworkErrorFallbackProps {
  title?: string;
  message?: string;
  showRetry?: boolean;
  showOfflineMode?: boolean;
  onRetry?: () => void;
  onOfflineMode?: () => void;
}

export const NetworkErrorFallback: React.FC<NetworkErrorFallbackProps> = ({
  title = 'Connection Error',
  message = 'Unable to connect to the server. Please check your internet connection.',
  showRetry = true,
  showOfflineMode = false,
  onRetry,
  onOfflineMode
}) => {
  const handleRetry = () => {
    if (onRetry) {
      onRetry();
    } else {
      window.location.reload();
    }
  };

  return (
    <Card className=\"max-w-md mx-auto mt-8\">
      <CardHeader>
        <CardTitle className=\"flex items-center gap-2 text-red-600\">
          <AlertTriangle className=\"h-5 w-5\" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className=\"space-y-4\">
        <Alert variant=\"destructive\">
          <AlertTriangle className=\"h-4 w-4\" />
          <AlertDescription>{message}</AlertDescription>
        </Alert>

        <div className=\"flex flex-col gap-2\">
          {showRetry && (
            <Button onClick={handleRetry} className=\"flex items-center gap-2\">
              <RefreshCw className=\"h-4 w-4\" />
              Try Again
            </Button>
          )}
          
          {showOfflineMode && onOfflineMode && (
            <Button onClick={onOfflineMode} variant=\"outline\" className=\"flex items-center gap-2\">
              <EyeOff className=\"h-4 w-4\" />
              Continue Offline
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Higher-order component for graceful degradation
interface WithGracefulDegradationProps {
  hasPermission: boolean;
  isLoading?: boolean;
  error?: any;
  permissionDeniedProps?: Partial<PermissionDeniedProps>;
  featureUnavailableProps?: Partial<FeatureUnavailableProps>;
  children: React.ReactNode;
}

export const WithGracefulDegradation: React.FC<WithGracefulDegradationProps> = ({
  hasPermission,
  isLoading = false,
  error,
  permissionDeniedProps = {},
  featureUnavailableProps = {},
  children
}) => {
  if (isLoading) {
    return (
      <div className=\"flex items-center justify-center p-8\">
        <RefreshCw className=\"h-8 w-8 animate-spin text-blue-600\" />
      </div>
    );
  }

  if (error) {
    if (error.response?.status === 403 || error.code === 'PERMISSION_DENIED') {
      return <PermissionDenied {...permissionDeniedProps} />;
    }
    
    if (error.code === 'NETWORK_ERROR' || !error.response) {
      return <NetworkErrorFallback />;
    }
    
    return <FeatureUnavailable {...featureUnavailableProps} />;
  }

  if (!hasPermission) {
    return <PermissionDenied {...permissionDeniedProps} />;
  }

  return <>{children}</>;
};

export default {
  PermissionDenied,
  FeatureUnavailable,
  LimitedView,
  DataMasked,
  NetworkErrorFallback,
  WithGracefulDegradation
};