import express from 'express';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import { PricingService } from '../services/pricingService.js';

const router = express.Router();

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Get projects for user (role-based access)
router.get('/', authenticateToken, async (req, res) => {
  try {
    // Get user role to determine what projects they can see
    const userResult = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    const userRole = userResult.rows[0]?.role;

    let query, params;

    if (userRole === 'agent') {
      // Agents can see ALL projects
      query = `SELECT p.*, 
                      u_client.full_name as client_name,
                      u_worker.full_name as worker_name,
                      u_agent.full_name as agent_name
               FROM projects p
               LEFT JOIN users u_client ON p.client_id = u_client.id
               LEFT JOIN users u_worker ON p.worker_id = u_worker.id  
               LEFT JOIN users u_agent ON p.agent_id = u_agent.id
               ORDER BY p.created_at DESC`;
      params = [];
    } else {
      // Clients and workers only see their own projects
      query = `SELECT p.*, 
                      u_client.full_name as client_name,
                      u_worker.full_name as worker_name,
                      u_agent.full_name as agent_name
               FROM projects p
               LEFT JOIN users u_client ON p.client_id = u_client.id
               LEFT JOIN users u_worker ON p.worker_id = u_worker.id  
               LEFT JOIN users u_agent ON p.agent_id = u_agent.id
               WHERE p.client_id = $1 OR p.worker_id = $1 OR p.agent_id = $1
               ORDER BY p.created_at DESC`;
      params = [req.userId];
    }

    const result = await pool.query(query, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

// Get project details
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;

    // Get project data
    const projectResult = await pool.query(
      `SELECT p.*, 
              u_client.full_name as client_name,
              u_worker.full_name as worker_name,
              u_agent.full_name as agent_name
       FROM projects p
       LEFT JOIN users u_client ON p.client_id = u_client.id
       LEFT JOIN users u_worker ON p.worker_id = u_worker.id  
       LEFT JOIN users u_agent ON p.agent_id = u_agent.id
       WHERE p.id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Get project files
    const filesResult = await pool.query(
      'SELECT * FROM project_files WHERE project_id = $1',
      [projectId]
    );

    // Get change requests
    const changesResult = await pool.query(
      'SELECT * FROM project_change_requests WHERE project_id = $1',
      [projectId]
    );

    // Get deadline extensions
    const extensionsResult = await pool.query(
      'SELECT * FROM deadline_extension_requests WHERE project_id = $1',
      [projectId]
    );

    const project = projectResult.rows[0];
    project.project_files = filesResult.rows;
    project.project_change_requests = changesResult.rows;
    project.deadline_extension_requests = extensionsResult.rows;

    res.json({ data: project });
  } catch (error) {
    console.error('Get project details error:', error);
    res.status(500).json({ error: 'Failed to fetch project details' });
  }
});

// Create new project
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      initial_word_count,
      deadline,
      order_reference,
      cost_gbp,
      deadline_charge,
      urgency_level,
      status
    } = req.body;

    const result = await pool.query(
      `INSERT INTO projects (
        client_id, title, description, initial_word_count, deadline, 
        order_reference, cost_gbp, deadline_charge, urgency_level, status,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
      RETURNING *`,
      [
        req.userId, title, description, initial_word_count, deadline,
        order_reference, cost_gbp || 0, deadline_charge || 0, 
        urgency_level || 'normal', status || 'pending_payment_approval'
      ]
    );

    res.status(201).json({ data: result.rows[0] });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Create project with proper pricing calculation (new endpoint)
router.post('/create', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      word_count,
      deadline,
      subject,
      academic_level,
      paper_type
    } = req.body;

    // Validate required fields
    if (!title || !description || !word_count || !deadline) {
      return res.status(400).json({ error: 'Title, description, word count, and deadline are required' });
    }

    // Calculate pricing using the pricing service
    const deadlineDate = new Date(deadline);
    const basePrice = PricingService.calculateSuperAgentPrice(word_count);
    const urgencyCharge = PricingService.calculateUrgencyCharge(deadlineDate);
    const urgencyLevel = PricingService.getUrgencyLevel(deadlineDate);
    const pricing = {
      basePrice,
      deadlineCharge: urgencyCharge,
      totalPrice: basePrice + urgencyCharge,
      urgencyLevel
    };

    // Create project with calculated pricing
    const result = await pool.query(
      `INSERT INTO projects (
        client_id, title, description, initial_word_count, word_count, deadline, 
        cost_gbp, deadline_charge, urgency_level, status,
        subject, academic_level, paper_type,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW())
      RETURNING *`,
      [
        req.userId, title, description, word_count, word_count, deadline,
        pricing.totalPrice, pricing.deadlineCharge, pricing.urgencyLevel, 'pending_payment_approval',
        subject, academic_level, paper_type
      ]
    );

    // Send notification to agents about new project
    await pool.query(
      `INSERT INTO notifications (recipient_role, type, message, project_id, created_at)
       VALUES ('agent', 'new_project', 'New project submitted: ${title}', $1, NOW())`,
      [result.rows[0].id]
    );

    res.status(201).json({ 
      project: result.rows[0],
      pricing: pricing
    });
  } catch (error) {
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// Update project status
router.patch('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const projectId = req.params.id;

    const result = await pool.query(
      'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [status, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Update project status error:', error);
    res.status(500).json({ error: 'Failed to update project status' });
  }
});

// Assign worker to project
router.patch('/:id/assign-worker', authenticateToken, async (req, res) => {
  try {
    const { workerId, assignedBy } = req.body;
    const projectId = req.params.id;

    // Determine which field to update based on who is assigning
    let updateQuery;
    let updateParams;

    if (assignedBy === 'super_worker') {
      // Super Worker assigns to sub_worker_id
      updateQuery = 'UPDATE projects SET sub_worker_id = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *';
      updateParams = [workerId, 'in_progress', projectId];
    } else {
      // Agent assigns to worker_id (default behavior)
      updateQuery = 'UPDATE projects SET worker_id = $1, status = $2, updated_at = NOW() WHERE id = $3 RETURNING *';
      updateParams = [workerId, 'in_progress', projectId];
    }

    const result = await pool.query(updateQuery, updateParams);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Assign worker error:', error);
    res.status(500).json({ error: 'Failed to assign worker' });
  }
});

// Get available workers
router.get('/workers/available', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, full_name, email FROM users WHERE role = $1',
      ['worker']
    );

    res.json({ data: result.rows });
  } catch (error) {
    console.error('Get workers error:', error);
    res.status(500).json({ error: 'Failed to fetch workers' });
  }
});

// Request word count change
router.patch('/:id/request-word-count-change', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { newWordCount } = req.body;

    // Get current project
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];
    
    // Use correct tiered pricing calculation
    const deadline = new Date(project.deadline);
    const now = new Date();
    
    // Calculate base price using tiered pricing
    const PRICING_TABLE = [
      { maxWords: 500, price: 45 },
      { maxWords: 1000, price: 55 },
      { maxWords: 1500, price: 65 },
      { maxWords: 2000, price: 70 },
      { maxWords: 2500, price: 85 },
      { maxWords: 3000, price: 100 },
      { maxWords: 3500, price: 110 },
      { maxWords: 4000, price: 120 },
      { maxWords: 4500, price: 130 },
      { maxWords: 5000, price: 140 },
      { maxWords: 5500, price: 150 },
      { maxWords: 6000, price: 160 },
      { maxWords: 6500, price: 170 },
      { maxWords: 7000, price: 180 },
      { maxWords: 7500, price: 190 },
      { maxWords: 8000, price: 200 },
      { maxWords: 8500, price: 210 },
      { maxWords: 9000, price: 220 },
      { maxWords: 9500, price: 230 },
      { maxWords: 10000, price: 240 }
    ];
    
    const tier = PRICING_TABLE.find(p => newWordCount <= p.maxWords);
    const basePrice = tier ? tier.price : PRICING_TABLE[PRICING_TABLE.length - 1].price;
    
    // Calculate deadline charge using correct system
    const daysDiff = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 3600 * 24));
    let deadlineCharge = 0;
    let urgencyLevel = 'normal';
    
    if (daysDiff <= 1) {
      deadlineCharge = 30;
      urgencyLevel = 'rush';
    } else if (daysDiff <= 2) {
      deadlineCharge = 10;
      urgencyLevel = 'urgent';
    } else if (daysDiff <= 6) {
      deadlineCharge = 5;
      urgencyLevel = 'moderate';
    }
    
    const totalCost = basePrice + deadlineCharge;

    // Update project with new word count and correct pricing
    const result = await pool.query(
      `UPDATE projects 
       SET adjusted_word_count = $1, cost_gbp = $2, deadline_charge = $3, urgency_level = $4,
           status = 'pending_quote_approval', adjustment_type = 'word_count', updated_at = NOW()
       WHERE id = $5 
       RETURNING *`,
      [newWordCount, totalCost, deadlineCharge, urgencyLevel, projectId]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Request word count change error:', error);
    res.status(500).json({ error: 'Failed to request word count change' });
  }
});

// Request deadline change
router.patch('/:id/request-deadline-change', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { newDeadline } = req.body;

    // Get current project
    const projectResult = await pool.query('SELECT * FROM projects WHERE id = $1', [projectId]);
    if (projectResult.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const project = projectResult.rows[0];
    
    // Use correct tiered pricing calculation
    const wordCount = project.adjusted_word_count || project.initial_word_count;
    const deadlineDate = new Date(newDeadline);
    const now = new Date();
    
    // Calculate base price using tiered pricing
    const PRICING_TABLE = [
      { maxWords: 500, price: 45 },
      { maxWords: 1000, price: 55 },
      { maxWords: 1500, price: 65 },
      { maxWords: 2000, price: 70 },
      { maxWords: 2500, price: 85 },
      { maxWords: 3000, price: 100 },
      { maxWords: 3500, price: 110 },
      { maxWords: 4000, price: 120 },
      { maxWords: 4500, price: 130 },
      { maxWords: 5000, price: 140 },
      { maxWords: 5500, price: 150 },
      { maxWords: 6000, price: 160 },
      { maxWords: 6500, price: 170 },
      { maxWords: 7000, price: 180 },
      { maxWords: 7500, price: 190 },
      { maxWords: 8000, price: 200 },
      { maxWords: 8500, price: 210 },
      { maxWords: 9000, price: 220 },
      { maxWords: 9500, price: 230 },
      { maxWords: 10000, price: 240 }
    ];
    
    const tier = PRICING_TABLE.find(p => wordCount <= p.maxWords);
    const basePrice = tier ? tier.price : PRICING_TABLE[PRICING_TABLE.length - 1].price;
    
    // Calculate deadline charge using correct fixed amounts
    const daysDiff = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 3600 * 24));
    let deadlineCharge = 0;
    let urgencyLevel = 'normal';
    
    if (daysDiff <= 1) {
      deadlineCharge = 30;
      urgencyLevel = 'rush';
    } else if (daysDiff <= 2) {
      deadlineCharge = 10;
      urgencyLevel = 'urgent';
    } else if (daysDiff <= 6) {
      deadlineCharge = 5;
      urgencyLevel = 'moderate';
    }
    
    const totalCost = basePrice + deadlineCharge;

    // Update project with new deadline and correct pricing
    const result = await pool.query(
      `UPDATE projects 
       SET deadline = $1, cost_gbp = $2, deadline_charge = $3, urgency_level = $4, 
           status = 'pending_quote_approval', adjustment_type = 'deadline', updated_at = NOW()
       WHERE id = $5 
       RETURNING *`,
      [newDeadline, totalCost, deadlineCharge, urgencyLevel, projectId]
    );

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Request deadline change error:', error);
    res.status(500).json({ error: 'Failed to request deadline change' });
  }
});

// Revert quote changes
router.patch('/:id/revert-quote', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { originalWordCount, originalCost, originalDeadlineCharge, originalUrgencyLevel } = req.body;

    // Revert project to original word count and pricing
    const result = await pool.query(
      `UPDATE projects 
       SET adjusted_word_count = NULL, cost_gbp = $1, deadline_charge = $2, urgency_level = $3,
           status = 'in_progress', adjustment_type = NULL, updated_at = NOW()
       WHERE id = $4 
       RETURNING *`,
      [originalCost, originalDeadlineCharge, originalUrgencyLevel, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Revert quote error:', error);
    res.status(500).json({ error: 'Failed to revert quote changes' });
  }
});

// Revert deadline changes
router.patch('/:id/revert-deadline', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { originalDeadline, originalCost, originalDeadlineCharge, originalUrgencyLevel } = req.body;

    // Revert project to original deadline and pricing
    const result = await pool.query(
      `UPDATE projects 
       SET deadline = $1, cost_gbp = $2, deadline_charge = $3, urgency_level = $4,
           status = 'in_progress', adjustment_type = NULL, updated_at = NOW()
       WHERE id = $5 
       RETURNING *`,
      [originalDeadline, originalCost, originalDeadlineCharge, originalUrgencyLevel, projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({ data: result.rows[0] });
  } catch (error) {
    console.error('Revert deadline error:', error);
    res.status(500).json({ error: 'Failed to revert deadline changes' });
  }
});

// Submit change request
router.post('/:id/change-request', authenticateToken, async (req, res) => {
  try {
    const projectId = req.params.id;
    const { instructions } = req.body;

    if (!instructions || instructions.trim().length === 0) {
      return res.status(400).json({ error: 'Instructions are required' });
    }

    // Insert change request into database
    const result = await pool.query(
      'INSERT INTO project_change_requests (project_id, instructions, created_at) VALUES ($1, $2, NOW()) RETURNING *',
      [projectId, instructions.trim()]
    );

    // Update project status to needs_changes
    await pool.query(
      'UPDATE projects SET status = $1, updated_at = NOW() WHERE id = $2',
      ['needs_changes', projectId]
    );

    res.json({ 
      data: result.rows[0],
      message: 'Change request submitted successfully'
    });
  } catch (error) {
    console.error('Submit change request error:', error);
    res.status(500).json({ error: 'Failed to submit change request' });
  }
});

export default router;