import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  History, 
  CheckCircle, 
  XCircle, 
  AlertTriangle,
  TrendingUp,
  Clock,
  Target,
  Settings
} from 'lucide-react';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  hierarchy_level: number;
  current_projects?: number;
  recommendation_score?: number;
  workload_status?: string;
}

interface AssignmentHistory {
  assignment_id: number;
  assignment_type: string;
  assigned_to_name: string;
  assigned_to_role: string;
  assigned_by_name: string;
  assigned_by_role: string;
  assignment_reason: string;
  assignment_notes: string;
  assigned_at: string;
  effective_until: string | null;
  is_valid_hierarchy: boolean;
  validation_notes: string;
  hierarchy_level: number;
}

interface Project {
  id: number;
  title: string;
  description: string;
  status: string;
  cost_gbp: number;
  project_numbers: string[];
  client_name: string;
  agent_name: string;
  worker_name: string;
  sub_agent_name: string;
  sub_worker_name: string;
}

interface ProjectAssignmentManagerProps {
  projectId: number;
  onAssignmentComplete?: () => void;
}

const ProjectAssignmentManager: React.FC<ProjectAssignmentManagerProps> = ({ 
  projectId, 
  onAssignmentComplete 
}) => {
  const [project, setProject] = useState<Project | null>(null);
  const [assignmentHistory, setAssignmentHistory] = useState<AssignmentHistory[]>([]);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);
  const [recommendations, setRecommendations] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [assignmentForm, setAssignmentForm] = useState({
    assigneeId: '',
    assignmentType: 'worker',
    assignmentReason: '',
    assignmentNotes: ''
  });
  
  const [projectNumbers, setProjectNumbers] = useState<string[]>([]);
  const [newProjectNumber, setNewProjectNumber] = useState('');

  useEffect(() => {
    if (projectId) {
      loadProjectData();
      loadAssignmentHistory();
    }
  }, [projectId]);

  useEffect(() => {
    if (assignmentForm.assignmentType) {
      loadAvailableUsers(assignmentForm.assignmentType);
      loadRecommendations(assignmentForm.assignmentType);
    }
  }, [assignmentForm.assignmentType]);

  const loadProjectData = async () => {
    try {
      const response = await fetch(`/api/project-assignment/summary/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setProject(data.data.project);
        setProjectNumbers(data.data.project.project_numbers || []);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to load project data');
    }
  };

  const loadAssignmentHistory = async () => {
    try {
      const response = await fetch(`/api/project-assignment/history/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAssignmentHistory(data.data);
      }
    } catch (err) {
      console.error('Failed to load assignment history:', err);
    }
  };

  const loadAvailableUsers = async (assignmentType: string) => {
    try {
      const response = await fetch(`/api/project-assignment/available-users/${assignmentType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setAvailableUsers(data.data);
      }
    } catch (err) {
      console.error('Failed to load available users:', err);
    }
  };

  const loadRecommendations = async (assignmentType: string) => {
    try {
      const response = await fetch(`/api/project-assignment/recommendations/${projectId}/${assignmentType}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.data);
      }
    } catch (err) {
      console.error('Failed to load recommendations:', err);
    }
  };

  const handleAssignment = async () => {
    if (!assignmentForm.assigneeId || !assignmentForm.assignmentType) {
      setError('Please select a user and assignment type');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/project-assignment/assign', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          projectId,
          ...assignmentForm
        })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Assignment completed successfully');
        setAssignmentForm({
          assigneeId: '',
          assignmentType: 'worker',
          assignmentReason: '',
          assignmentNotes: ''
        });
        loadProjectData();
        loadAssignmentHistory();
        onAssignmentComplete?.();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to assign user to project');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateProjectNumbers = async () => {
    try {
      const response = await fetch(`/api/project-assignment/project-numbers/${projectId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ projectNumbers })
      });

      const data = await response.json();

      if (data.success) {
        setSuccess('Project numbers updated successfully');
        loadProjectData();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to update project numbers');
    }
  };

  const addProjectNumber = () => {
    if (newProjectNumber.trim() && !projectNumbers.includes(newProjectNumber.trim())) {
      setProjectNumbers([...projectNumbers, newProjectNumber.trim()]);
      setNewProjectNumber('');
    }
  };

  const removeProjectNumber = (index: number) => {
    setProjectNumbers(projectNumbers.filter((_, i) => i !== index));
  };

  const getWorkloadColor = (status: string) => {
    const colors = {
      'available': 'bg-green-100 text-green-800',
      'light': 'bg-blue-100 text-blue-800',
      'moderate': 'bg-yellow-100 text-yellow-800',
      'heavy': 'bg-orange-100 text-orange-800',
      'overloaded': 'bg-red-100 text-red-800'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (!project) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Project Assignment Manager</h2>
        <Badge variant="outline">{project.status}</Badge>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            {project.title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Description</p>
              <p className="font-medium">{project.description}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Cost</p>
              <p className="font-medium">£{project.cost_gbp}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Client</p>
              <p className="font-medium">{project.client_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Current Assignments</p>
              <div className="space-y-1">
                {project.agent_name && <Badge variant="secondary">Agent: {project.agent_name}</Badge>}
                {project.sub_agent_name && <Badge variant="secondary">Sub Agent: {project.sub_agent_name}</Badge>}
                {project.worker_name && <Badge variant="secondary">Worker: {project.worker_name}</Badge>}
                {project.sub_worker_name && <Badge variant="secondary">Sub Worker: {project.sub_worker_name}</Badge>}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="assign" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="assign">
            <UserPlus className="w-4 h-4 mr-2" />
            Assign
          </TabsTrigger>
          <TabsTrigger value="history">
            <History className="w-4 h-4 mr-2" />
            History
          </TabsTrigger>
          <TabsTrigger value="recommendations">
            <TrendingUp className="w-4 h-4 mr-2" />
            Recommendations
          </TabsTrigger>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </TabsTrigger>
        </TabsList>

        <TabsContent value="assign">
          <Card>
            <CardHeader>
              <CardTitle>Assign User to Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="assignmentType">Assignment Type</Label>
                  <Select
                    value={assignmentForm.assignmentType}
                    onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, assignmentType: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select assignment type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="worker">Worker</SelectItem>
                      <SelectItem value="sub_worker">Sub Worker</SelectItem>
                      <SelectItem value="agent">Agent</SelectItem>
                      <SelectItem value="sub_agent">Sub Agent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="assigneeId">Select User</Label>
                  <Select
                    value={assignmentForm.assigneeId}
                    onValueChange={(value) => setAssignmentForm(prev => ({ ...prev, assigneeId: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select user to assign" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableUsers.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.role}) - Level {user.hierarchy_level}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="assignmentReason">Assignment Reason</Label>
                <Input
                  id="assignmentReason"
                  value={assignmentForm.assignmentReason}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, assignmentReason: e.target.value }))}
                  placeholder="Why is this assignment being made?"
                />
              </div>

              <div>
                <Label htmlFor="assignmentNotes">Assignment Notes</Label>
                <Textarea
                  id="assignmentNotes"
                  value={assignmentForm.assignmentNotes}
                  onChange={(e) => setAssignmentForm(prev => ({ ...prev, assignmentNotes: e.target.value }))}
                  placeholder="Additional notes about this assignment..."
                />
              </div>

              <Button onClick={handleAssignment} disabled={loading} className="w-full">
                {loading ? 'Assigning...' : 'Assign User'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Assignment History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {assignmentHistory.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No assignment history available</p>
                ) : (
                  assignmentHistory.map((assignment) => (
                    <div key={assignment.assignment_id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={assignment.is_valid_hierarchy ? "default" : "destructive"}>
                            {assignment.assignment_type}
                          </Badge>
                          {assignment.is_valid_hierarchy ? (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          ) : (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <span className="text-sm text-gray-500">
                          {formatDate(assignment.assigned_at)}
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Assigned To:</span> {assignment.assigned_to_name} ({assignment.assigned_to_role})
                        </div>
                        <div>
                          <span className="font-medium">Assigned By:</span> {assignment.assigned_by_name} ({assignment.assigned_by_role})
                        </div>
                        {assignment.assignment_reason && (
                          <div className="md:col-span-2">
                            <span className="font-medium">Reason:</span> {assignment.assignment_reason}
                          </div>
                        )}
                        {assignment.assignment_notes && (
                          <div className="md:col-span-2">
                            <span className="font-medium">Notes:</span> {assignment.assignment_notes}
                          </div>
                        )}
                        {!assignment.is_valid_hierarchy && (
                          <div className="md:col-span-2 text-red-600">
                            <span className="font-medium">Validation Issue:</span> {assignment.validation_notes}
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations">
          <Card>
            <CardHeader>
              <CardTitle>Assignment Recommendations</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recommendations.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">No recommendations available</p>
                ) : (
                  recommendations.map((user) => (
                    <div key={user.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <h4 className="font-medium">{user.full_name}</h4>
                          <p className="text-sm text-gray-600">{user.email} • {user.role}</p>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-blue-600">
                            {user.recommendation_score}/100
                          </div>
                          <Badge className={getWorkloadColor(user.workload_status || 'available')}>
                            {user.workload_status}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium">Hierarchy Level:</span> {user.hierarchy_level}
                        </div>
                        <div>
                          <span className="font-medium">Current Projects:</span> {user.current_projects || 0}
                        </div>
                        <div>
                          <Button
                            size="sm"
                            onClick={() => setAssignmentForm(prev => ({ ...prev, assigneeId: user.id }))}
                          >
                            Select
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Project Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Project Numbers</Label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newProjectNumber}
                      onChange={(e) => setNewProjectNumber(e.target.value)}
                      placeholder="Add project number..."
                    />
                    <Button onClick={addProjectNumber}>Add</Button>
                  </div>
                  
                  <div className="flex flex-wrap gap-2">
                    {projectNumbers.map((number, index) => (
                      <Badge key={index} variant="secondary" className="cursor-pointer">
                        {number}
                        <button
                          onClick={() => removeProjectNumber(index)}
                          className="ml-2 text-red-600 hover:text-red-800"
                        >
                          ×
                        </button>
                      </Badge>
                    ))}
                  </div>
                  
                  <Button onClick={handleUpdateProjectNumbers} variant="outline">
                    Update Project Numbers
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProjectAssignmentManager;