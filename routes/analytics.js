/**
 * Analytics API Routes
 * Handles earnings and analytics calculations for all user roles
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler, createValidationError, createPermissionError, createNotFoundError } from '../middleware/errorHandler.js';
import AnalyticsService from '../services/analyticsService.js';
import HierarchyService from '../services/hierarchyService.js';

const router = express.Router();
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

// Get user's analytics
router.get('/my-analytics', authenticateToken, asyncHandler(async (req, res) => {
  const { period = 'all', startDate, endDate } = req.query;
  
  // Get user info to determine role
  const userInfo = await HierarchyService.getUserInfo(req.userId);
  if (!userInfo) {
    throw createNotFoundError('User');
  }

  let analytics;
  
  switch (period) {
    case 'current_month':
      analytics = await AnalyticsService.getCurrentMonthAnalytics(req.userId, userInfo.role);
      break;
    case 'year_to_date':
      analytics = await AnalyticsService.getYearToDateAnalytics(req.userId, userInfo.role);
      break;
    case 'custom':
      if (!startDate || !endDate) {
        throw createValidationError('startDate and endDate are required for custom period');
      }
      analytics = await AnalyticsService.getUserAnalytics(req.userId, userInfo.role, new Date(startDate), new Date(endDate));
      break;
    default:
      analytics = await AnalyticsService.getUserAnalytics(req.userId, userInfo.role);
  }

  res.json({
    success: true,
    data: analytics
  });
}));

// Get Super Worker analytics (Super Worker or Super Agent only)
router.get('/super-worker/:userId', authenticateToken, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;
  
  // Check permissions
  const requesterInfo = await HierarchyService.getUserInfo(req.userId);
  const targetInfo = await HierarchyService.getUserInfo(userId);
  
  if (!requesterInfo || !targetInfo) {
    throw createNotFoundError('User');
  }

  // Only Super Agent or the Super Worker themselves can access this
  if (requesterInfo.role !== 'super_agent' && req.userId !== userId) {
    throw createPermissionError('Only Super Agents or the Super Worker themselves can access these analytics');
  }

  if (targetInfo.role !== 'super_worker') {
    throw createValidationError('Target user must be a Super Worker');
  }

  const analytics = await AnalyticsService.calculateSuperWorkerAnalytics(
    userId, 
    startDate ? new Date(startDate) : null, 
    endDate ? new Date(endDate) : null
  );

  res.json({
    success: true,
    data: analytics
  });
}));

// Get Super Agent analytics (Super Agent only)
router.get('/super-agent/:userId', authenticateToken, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;
  
  // Check permissions
  const requesterInfo = await HierarchyService.getUserInfo(req.userId);
  const targetInfo = await HierarchyService.getUserInfo(userId);
  
  if (!requesterInfo || !targetInfo) {
    throw createNotFoundError('User');
  }

  // Only Super Agent themselves can access this
  if (requesterInfo.role !== 'super_agent' || req.userId !== userId) {
    throw createPermissionError('Only the Super Agent can access these analytics');
  }

  const analytics = await AnalyticsService.calculateSuperAgentAnalytics(
    userId, 
    startDate ? new Date(startDate) : null, 
    endDate ? new Date(endDate) : null
  );

  res.json({
    success: true,
    data: analytics
  });
}));

// Get Agent analytics (Agent or Super Agent only)
router.get('/agent/:userId', authenticateToken, asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { startDate, endDate } = req.query;
  
  // Check permissions
  const requesterInfo = await HierarchyService.getUserInfo(req.userId);
  const targetInfo = await HierarchyService.getUserInfo(userId);
  
  if (!requesterInfo || !targetInfo) {
    throw createNotFoundError('User');
  }

  // Only Super Agent or the Agent themselves can access this
  if (requesterInfo.role !== 'super_agent' && req.userId !== userId) {
    throw createPermissionError('Only Super Agents or the Agent themselves can access these analytics');
  }

  if (targetInfo.role !== 'agent') {
    throw createValidationError('Target user must be an Agent');
  }

  const analytics = await AnalyticsService.calculateAgentAnalytics(
    userId, 
    startDate ? new Date(startDate) : null, 
    endDate ? new Date(endDate) : null
  );

  res.json({
    success: true,
    data: analytics
  });
}));

// Get analytics summary for dashboard
router.get('/dashboard-summary', authenticateToken, asyncHandler(async (req, res) => {
  const userInfo = await HierarchyService.getUserInfo(req.userId);
  if (!userInfo) {
    throw createNotFoundError('User');
  }

  // Get current month and year-to-date analytics
  const currentMonth = await AnalyticsService.getCurrentMonthAnalytics(req.userId, userInfo.role);
  const yearToDate = await AnalyticsService.getYearToDateAnalytics(req.userId, userInfo.role);

  res.json({
    success: true,
    data: {
      user_role: userInfo.role,
      current_month: currentMonth.summary,
      year_to_date: yearToDate.summary
    }
  });
}));

// Track earnings for completed project (internal use)
router.post('/track-project-earnings', authenticateToken, asyncHandler(async (req, res) => {
  const { projectId } = req.body;
  
  if (!projectId) {
    throw createValidationError('projectId is required');
  }

  // Check if user has permission to track earnings (Super Agent or project owner)
  const userInfo = await HierarchyService.getUserInfo(req.userId);
  if (!userInfo || !['super_agent', 'agent'].includes(userInfo.role)) {
    throw createPermissionError('Only Super Agents or Agents can track project earnings');
  }

  await AnalyticsService.trackProjectEarnings(projectId);

  res.json({
    success: true,
    message: 'Project earnings tracked successfully'
  });
}));

// Get earnings comparison (Super Agent only)
router.get('/earnings-comparison', authenticateToken, asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  // Check permissions
  const userInfo = await HierarchyService.getUserInfo(req.userId);
  if (!userInfo || userInfo.role !== 'super_agent') {
    throw createPermissionError('Only Super Agents can access earnings comparison');
  }

  // Get all agents and super workers
  const agents = await HierarchyService.getUsersByRole('agent');
  const superWorkers = await HierarchyService.getUsersByRole('super_worker');

  const agentEarnings = [];
  const superWorkerEarnings = [];

  // Calculate analytics for each agent
  for (const agent of agents) {
    try {
      const analytics = await AnalyticsService.calculateAgentAnalytics(
        agent.id,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );
      agentEarnings.push({
        user_id: agent.id,
        full_name: agent.full_name,
        ...analytics.summary
      });
    } catch (error) {
      console.error(`Error calculating analytics for agent ${agent.id}:`, error);
    }
  }

  // Calculate analytics for each super worker
  for (const superWorker of superWorkers) {
    try {
      const analytics = await AnalyticsService.calculateSuperWorkerAnalytics(
        superWorker.id,
        startDate ? new Date(startDate) : null,
        endDate ? new Date(endDate) : null
      );
      superWorkerEarnings.push({
        user_id: superWorker.id,
        full_name: superWorker.full_name,
        ...analytics.summary
      });
    } catch (error) {
      console.error(`Error calculating analytics for super worker ${superWorker.id}:`, error);
    }
  }

  res.json({
    success: true,
    data: {
      period: {
        start_date: startDate,
        end_date: endDate
      },
      agent_earnings: agentEarnings,
      super_worker_earnings: superWorkerEarnings
    }
  });
}));

export default router;