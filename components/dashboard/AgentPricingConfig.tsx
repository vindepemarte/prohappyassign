import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  Calculator, 
  History, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle, 
  DollarSign,
  Settings,
  BarChart3
} from 'lucide-react';

interface PricingConfig {
  id?: number;
  agent_id: string;
  min_word_count: number;
  max_word_count: number;
  base_rate_per_500_words: number;
  agent_fee_percentage: number;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
}

interface PricingHistory {
  id: number;
  change_type: string;
  min_word_count: number;
  max_word_count: number;
  base_rate_per_500_words: number;
  agent_fee_percentage: number;
  change_reason: string;
  changed_by_name: string;
  created_at: string;
  effective_from: string;
  effective_until: string | null;
}

interface PricingCalculation {
  word_count: number;
  base_units: number;
  breakdown: {
    base_cost: number;
    agent_fee: number;
    super_worker_fee: number;
    worker_fee: number;
    client_total: number;
    system_total: number;
  };
  pricing_config: {
    base_rate_per_500_words: number;
    agent_fee_percentage: number;
    is_default: boolean;
  };
}

interface AgentStats {
  total_projects: number;
  total_revenue: number;
  total_fees_owed_to_super_agent: number;
  total_agent_profit: number;
  projects_this_month: number;
  average_project_value: number;
}

const AgentPricingConfig: React.FC = () => {
  const [currentPricing, setCurrentPricing] = useState<PricingConfig | null>(null);
  const [pricingHistory, setPricingHistory] = useState<PricingHistory[]>([]);
  const [agentStats, setAgentStats] = useState<AgentStats | null>(null);
  const [calculation, setCalculation] = useState<PricingCalculation | null>(null);
  
  const [formData, setFormData] = useState({
    min_word_count: 500,
    max_word_count: 20000,
    base_rate_per_500_words: 6.25,
    agent_fee_percentage: 15.0,
    change_reason: ''
  });
  
  const [calculatorWordCount, setCalculatorWordCount] = useState(1000);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [validation, setValidation] = useState<any>(null);

  useEffect(() => {
    loadCurrentPricing();
    loadPricingHistory();
    loadAgentStats();
  }, []);

  useEffect(() => {
    if (currentPricing) {
      setFormData({
        min_word_count: currentPricing.min_word_count,
        max_word_count: currentPricing.max_word_count,
        base_rate_per_500_words: currentPricing.base_rate_per_500_words,
        agent_fee_percentage: currentPricing.agent_fee_percentage,
        change_reason: ''
      });
    }
  }, [currentPricing]);

  const loadCurrentPricing = async () => {
    try {
      const response = await fetch('/api/agent-pricing/current', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setCurrentPricing(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load pricing configuration');
    }
  };

  const loadPricingHistory = async () => {
    try {
      const response = await fetch('/api/agent-pricing/history/current', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setPricingHistory(data.data.history);
      }
    } catch (err) {
      console.error('Failed to load pricing history:', err);
    }
  };

  const loadAgentStats = async () => {
    try {
      const response = await fetch('/api/agent-pricing/stats/current', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      const data = await response.json();
      
      if (data.success) {
        setAgentStats(data.data);
      }
    } catch (err) {
      console.error('Failed to load agent stats:', err);
    }
  };

  const validatePricing = async (pricingData: any) => {
    try {
      const response = await fetch('/api/agent-pricing/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(pricingData)
      });
      const data = await response.json();
      
      if (data.success) {
        setValidation(data.data);
        return data.data.valid;
      }
      return false;
    } catch (err) {
      console.error('Failed to validate pricing:', err);
      return false;
    }
  };

  const calculatePricing = async (wordCount: number) => {
    try {
      const response = await fetch('/api/agent-pricing/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ word_count: wordCount })
      });
      const data = await response.json();
      
      if (data.success) {
        setCalculation(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to calculate pricing');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Validate first
      const isValid = await validatePricing(formData);
      if (!isValid) {
        setError('Please fix validation errors before saving');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/agent-pricing/current', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Pricing configuration updated successfully');
        setCurrentPricing(data.data);
        loadPricingHistory(); // Reload history to show the change
        setFormData(prev => ({ ...prev, change_reason: '' })); // Clear change reason
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update pricing configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleCalculate = () => {
    if (calculatorWordCount > 0) {
      calculatePricing(calculatorWordCount);
    }
  };

  const formatCurrency = (amount: number) => `£${amount.toFixed(2)}`;
  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Agent Pricing Configuration</h2>
        <Badge variant={currentPricing?.is_default ? "secondary" : "default"}>
          {currentPricing?.is_default ? "Default Pricing" : "Custom Pricing"}
        </Badge>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="configuration" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="configuration">
            <Settings className="w-4 h-4 mr-2" />
            Configuration
          </TabsTrigger>
          <TabsTrigger value="calculator">
            <Calculator className="w-4 h-4 mr-2" />
            Calculator
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="min_word_count">Minimum Word Count</Label>
                    <Input
                      id="min_word_count"
                      type="number"
                      min="500"
                      max="20000"
                      value={formData.min_word_count}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        min_word_count: parseInt(e.target.value) 
                      }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="max_word_count">Maximum Word Count</Label>
                    <Input
                      id="max_word_count"
                      type="number"
                      min="500"
                      max="20000"
                      value={formData.max_word_count}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        max_word_count: parseInt(e.target.value) 
                      }))}
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="base_rate">Base Rate (per 500 words)</Label>
                    <Input
                      id="base_rate"
                      type="number"
                      step="0.01"
                      min="0.01"
                      value={formData.base_rate_per_500_words}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        base_rate_per_500_words: parseFloat(e.target.value) 
                      }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="agent_fee">Agent Fee Percentage</Label>
                    <Input
                      id="agent_fee"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={formData.agent_fee_percentage}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        agent_fee_percentage: parseFloat(e.target.value) 
                      }))}
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="change_reason">Change Reason (Optional)</Label>
                  <Textarea
                    id="change_reason"
                    placeholder="Describe why you're making this change..."
                    value={formData.change_reason}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      change_reason: e.target.value 
                    }))}
                  />
                </div>

                {validation && (
                  <div className="space-y-2">
                    {validation.errors.length > 0 && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="list-disc list-inside">
                            {validation.errors.map((error: string, index: number) => (
                              <li key={index}>{error}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {validation.warnings.length > 0 && (
                      <Alert>
                        <AlertTriangle className="h-4 w-4" />
                        <AlertDescription>
                          <ul className="list-disc list-inside">
                            {validation.warnings.map((warning: string, index: number) => (
                              <li key={index}>{warning}</li>
                            ))}
                          </ul>
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                )}

                <Button type="submit" disabled={loading} className="w-full">
                  {loading ? 'Updating...' : 'Update Pricing Configuration'}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calculator">
          <Card>
            <CardHeader>
              <CardTitle>Pricing Calculator</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="word_count">Word Count</Label>
                  <div className="flex gap-2">
                    <Input
                      id="word_count"
                      type="number"
                      min="1"
                      value={calculatorWordCount}
                      onChange={(e) => setCalculatorWordCount(parseInt(e.target.value))}
                    />
                    <Button onClick={handleCalculate}>Calculate</Button>
                  </div>
                </div>

                {calculation && (
                  <div className="grid grid-cols-2 gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Client Pricing</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span>Word Count:</span>
                          <span>{calculation.word_count}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Base Units (500-word):</span>
                          <span>{calculation.base_units}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Base Cost:</span>
                          <span>{formatCurrency(calculation.breakdown.base_cost)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Agent Fee:</span>
                          <span>{formatCurrency(calculation.breakdown.agent_fee)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                          <span>Client Total:</span>
                          <span>{formatCurrency(calculation.breakdown.client_total)}</span>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">System Breakdown</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex justify-between">
                          <span>Super Worker Fee:</span>
                          <span>{formatCurrency(calculation.breakdown.super_worker_fee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Worker Fee:</span>
                          <span>{formatCurrency(calculation.breakdown.worker_fee)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Agent Fee:</span>
                          <span>{formatCurrency(calculation.breakdown.agent_fee)}</span>
                        </div>
                        <div className="flex justify-between font-bold border-t pt-2">
                          <span>System Total:</span>
                          <span>{formatCurrency(calculation.breakdown.system_total)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Pricing History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {pricingHistory.length === 0 ? (
                  <p className="text-muted-foreground">No pricing history available.</p>
                ) : (
                  pricingHistory.map((entry) => (
                    <div key={entry.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant={entry.change_type === 'created' ? 'default' : 'secondary'}>
                          {entry.change_type}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {formatDate(entry.created_at)}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Base Rate:</span> {formatCurrency(entry.base_rate_per_500_words)}
                        </div>
                        <div>
                          <span className="font-medium">Agent Fee:</span> {entry.agent_fee_percentage}%
                        </div>
                        <div>
                          <span className="font-medium">Word Range:</span> {entry.min_word_count} - {entry.max_word_count}
                        </div>
                        <div>
                          <span className="font-medium">Changed By:</span> {entry.changed_by_name || 'System'}
                        </div>
                      </div>
                      {entry.change_reason && (
                        <div className="mt-2 text-sm">
                          <span className="font-medium">Reason:</span> {entry.change_reason}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {agentStats && (
              <>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{agentStats.total_projects}</div>
                    <p className="text-xs text-muted-foreground">
                      {agentStats.projects_this_month} this month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(agentStats.total_revenue)}</div>
                    <p className="text-xs text-muted-foreground">
                      Avg: {formatCurrency(agentStats.average_project_value)} per project
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Agent Profit</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(agentStats.total_agent_profit)}</div>
                    <p className="text-xs text-muted-foreground">
                      Fees owed: {formatCurrency(agentStats.total_fees_owed_to_super_agent)}
                    </p>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AgentPricingConfig;