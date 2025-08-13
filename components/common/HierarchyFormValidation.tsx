import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '../ui/alert';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { AlertTriangle, CheckCircle, Loader2, Users, ArrowRight } from 'lucide-react';
import { FormLoadingOverlay } from './LoadingStates';

interface ValidationError {
  field: string;
  message: string;
  code?: string;
}

interface User {
  id: string;
  full_name: string;
  role: string;
  hierarchy_level: number;
}

interface HierarchyMoveFormProps {
  onSubmit: (data: { userId: string; newParentId: string; reason: string }) => Promise<void>;
  users: User[];
  currentUser?: { id: string; full_name: string; role: string };
  isLoading?: boolean;
  error?: string | null;
}

export const HierarchyMoveForm: React.FC<HierarchyMoveFormProps> = ({
  onSubmit,
  users,
  currentUser,
  isLoading = false,
  error = null
}) => {
  const [formData, setFormData] = useState({
    userId: '',
    newParentId: '',
    reason: ''
  });
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [previewData, setPreviewData] = useState<{
    user?: User;
    newParent?: User;
    isValid: boolean;
    message?: string;
  }>({ isValid: false });

  // Validate form data
  const validateForm = () => {
    const errors: ValidationError[] = [];

    if (!formData.userId) {
      errors.push({ field: 'userId', message: 'Please select a user to move.' });
    }

    if (!formData.newParentId) {
      errors.push({ field: 'newParentId', message: 'Please select a new parent.' });
    }

    if (formData.userId === formData.newParentId) {
      errors.push({ 
        field: 'newParentId', 
        message: 'A user cannot be their own parent.',
        code: 'CIRCULAR_REFERENCE'
      });
    }

    if (!formData.reason.trim()) {
      errors.push({ field: 'reason', message: 'Please provide a reason for this move.' });
    } else if (formData.reason.trim().length < 10) {
      errors.push({ field: 'reason', message: 'Reason must be at least 10 characters long.' });
    }

    setValidationErrors(errors);
    return errors.length === 0;
  };

  // Update preview when form data changes
  useEffect(() => {
    if (formData.userId && formData.newParentId && formData.userId !== formData.newParentId) {
      const user = users.find(u => u.id === formData.userId);
      const newParent = users.find(u => u.id === formData.newParentId);
      
      if (user && newParent) {
        // Basic hierarchy validation
        const isValidMove = validateHierarchyMove(user, newParent);
        setPreviewData({
          user,
          newParent,
          isValid: isValidMove.valid,
          message: isValidMove.message
        });
      }
    } else {
      setPreviewData({ isValid: false });
    }
  }, [formData.userId, formData.newParentId, users]);

  const validateHierarchyMove = (user: User, newParent: User) => {
    // Role hierarchy validation
    const validRelationships = {
      'agent': ['super_agent'],
      'super_worker': ['agent'],
      'worker': ['super_worker'],
      'client': ['agent']
    };

    const allowedParents = validRelationships[user.role as keyof typeof validRelationships];
    
    if (!allowedParents || !allowedParents.includes(newParent.role)) {
      return {
        valid: false,
        message: `A ${user.role} cannot be placed under a ${newParent.role}. Valid parent roles: ${allowedParents?.join(', ') || 'none'}.`
      };
    }

    // Level validation
    if (newParent.hierarchy_level + 1 > 5) {
      return {
        valid: false,
        message: 'This move would exceed the maximum hierarchy depth of 5 levels.'
      };
    }

    return {
      valid: true,
      message: `${user.full_name} will be moved under ${newParent.full_name} at level ${newParent.hierarchy_level + 1}.`
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (!previewData.isValid) {
      setValidationErrors([{ 
        field: 'general', 
        message: previewData.message || 'Invalid hierarchy move.' 
      }]);
      return;
    }

    try {
      await onSubmit(formData);
      // Reset form on success
      setFormData({ userId: '', newParentId: '', reason: '' });
      setValidationErrors([]);
      setPreviewData({ isValid: false });
    } catch (error) {
      // Error handling is done by parent component
    }
  };

  const getFieldError = (field: string) => {
    return validationErrors.find(error => error.field === field)?.message;
  };

  const hasFieldError = (field: string) => {
    return validationErrors.some(error => error.field === field);
  };

  // Filter users for selection
  const selectableUsers = users.filter(user => 
    user.id !== currentUser?.id && user.role !== 'super_agent'
  );

  const selectableParents = users.filter(user => 
    user.id !== formData.userId && 
    ['super_agent', 'agent', 'super_worker'].includes(user.role)
  );

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Move User in Hierarchy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative">
          {isLoading && <FormLoadingOverlay message="Moving user in hierarchy..." />}
          
          {/* User Selection */}
          <div className="space-y-2">
            <Label htmlFor="userId">Select User to Move</Label>
            <Select 
              value={formData.userId} 
              onValueChange={(value: string) => setFormData(prev => ({ ...prev, userId: value }))}
            >
              <SelectTrigger className={hasFieldError('userId') ? 'border-red-500' : ''}>
                <SelectValue placeholder="Choose a user to move" />
              </SelectTrigger>
              <SelectContent>
                {selectableUsers.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.role} - Level {user.hierarchy_level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFieldError('userId') && (
              <p className="text-sm text-red-600">{getFieldError('userId')}</p>
            )}
          </div>

          {/* New Parent Selection */}
          <div className="space-y-2">
            <Label htmlFor="newParentId">Select New Parent</Label>
            <Select 
              value={formData.newParentId} 
              onValueChange={(value: string) => setFormData(prev => ({ ...prev, newParentId: value }))}
            >
              <SelectTrigger className={hasFieldError('newParentId') ? 'border-red-500' : ''}>
                <SelectValue placeholder="Choose new parent" />
              </SelectTrigger>
              <SelectContent>
                {selectableParents.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.role} - Level {user.hierarchy_level})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasFieldError('newParentId') && (
              <p className="text-sm text-red-600">{getFieldError('newParentId')}</p>
            )}
          </div>

          {/* Move Preview */}
          {previewData.user && previewData.newParent && (
            <div className={`p-4 rounded-lg border ${previewData.isValid ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-2 mb-2">
                {previewData.isValid ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertTriangle className="h-4 w-4 text-red-600" />
                )}
                <span className="font-medium">Move Preview</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <span>{previewData.user.full_name}</span>
                <ArrowRight className="h-3 w-3" />
                <span>{previewData.newParent.full_name}</span>
              </div>
              <p className={`text-sm mt-1 ${previewData.isValid ? 'text-green-700' : 'text-red-700'}`}>
                {previewData.message}
              </p>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for Move</Label>
            <Textarea
              id="reason"
              value={formData.reason}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Explain why this user is being moved (minimum 10 characters)"
              className={hasFieldError('reason') ? 'border-red-500' : ''}
              rows={3}
            />
            {hasFieldError('reason') && (
              <p className="text-sm text-red-600">{getFieldError('reason')}</p>
            )}
          </div>

          {/* General Errors */}
          {validationErrors.some(error => error.field === 'general') && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {validationErrors.find(error => error.field === 'general')?.message}
              </AlertDescription>
            </Alert>
          )}

          {/* Submit Button */}
          <div className="flex gap-3 pt-4">
            <Button 
              type="submit" 
              disabled={isLoading || !previewData.isValid}
              className="flex items-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Users className="h-4 w-4" />
              )}
              Move User
            </Button>
            <Button 
              type="button" 
              variant="outline"
              onClick={() => {
                setFormData({ userId: '', newParentId: '', reason: '' });
                setValidationErrors([]);
                setPreviewData({ isValid: false });
              }}
            >
              Clear Form
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

interface ValidationDetails {
  ownerName?: string;
  ownerRole?: string;
  codeType?: string;
}

interface ReferenceCodeValidationProps {
  onValidate: (code: string) => Promise<{ isValid: boolean; message?: string; details?: ValidationDetails }>;
  isLoading?: boolean;
  error?: string | null;
}

export const ReferenceCodeValidation: React.FC<ReferenceCodeValidationProps> = ({
  onValidate,
  isLoading = false,
  error = null
}) => {
  const [code, setCode] = useState('');
  const [validationResult, setValidationResult] = useState<{
    isValid?: boolean;
    message?: string;
    details?: ValidationDetails;
  } | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  const validateCode = async () => {
    if (!code.trim()) {
      setValidationResult({
        isValid: false,
        message: 'Please enter a reference code.'
      });
      return;
    }

    if (!/^[A-Z0-9]{5}$/.test(code.toUpperCase())) {
      setValidationResult({
        isValid: false,
        message: 'Reference code must be 5 characters (letters and numbers only, e.g., ABC12)'
      });
      return;
    }

    setIsValidating(true);
    try {
      const result = await onValidate(code.toUpperCase());
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        isValid: false,
        message: 'Failed to validate reference code. Please try again.'
      });
    } finally {
      setIsValidating(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    validateCode();
  };

  return (
    <Card className="max-w-md mx-auto">
      <CardHeader>
        <CardTitle>Validate Reference Code</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="referenceCode">Reference Code</Label>
            <Input
              id="referenceCode"
              value={code}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setCode(e.target.value.toUpperCase());
                setValidationResult(null);
              }}
              placeholder="ABC12"
              className="font-mono"
              maxLength={5}
            />
            <p className="text-xs text-gray-500">
              Format: 5 characters (letters and numbers)
            </p>
          </div>

          <Button 
            type="submit" 
            disabled={isValidating || isLoading || !code.trim()}
            className="w-full flex items-center gap-2"
          >
            {isValidating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Validate Code
          </Button>
        </form>

        {validationResult && (
          <Alert variant={validationResult.isValid ? "default" : "destructive"}>
            {validationResult.isValid ? (
              <CheckCircle className="h-4 w-4 text-green-600" />
            ) : (
              <AlertTriangle className="h-4 w-4" />
            )}
            <AlertDescription>
              {validationResult.message}
              {validationResult.details && (
                <div className="mt-2 text-sm">
                  <strong>Owner:</strong> {validationResult.details.ownerName} ({validationResult.details.ownerRole})
                  <br />
                  <strong>Type:</strong> {validationResult.details.codeType?.replace('_', ' ')}
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};

export default { HierarchyMoveForm, ReferenceCodeValidation };