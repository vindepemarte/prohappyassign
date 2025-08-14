/**
 * Pricing API Routes
 * Handles pricing calculations for assignments
 */

import express from 'express';
import jwt from 'jsonwebtoken';
import { asyncHandler, createValidationError, createPermissionError } from '../middleware/errorHandler.js';
import PricingService from '../services/pricingService.js';

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

// Calculate pricing for assignment
router.post('/calculate', authenticateToken, asyncHandler(async (req, res) => {
  const { wordCount, deadline, clientId } = req.body;

  // Use current user as client if not specified (for client users)
  const targetClientId = clientId || req.userId;

  // Validate input
  if (!wordCount || !deadline) {
    throw createValidationError('wordCount and deadline are required');
  }

  const deadlineDate = new Date(deadline);
  const validation = PricingService.validatePricingRequest(wordCount, deadlineDate);
  
  if (!validation.valid) {
    throw createValidationError('Invalid pricing request', validation.errors);
  }

  // Calculate pricing
  const pricingData = await PricingService.calculateAssignmentPricing(
    targetClientId, 
    wordCount, 
    deadlineDate
  );

  res.json({
    success: true,
    data: pricingData,
    formatted_breakdown: PricingService.formatPricingBreakdown(pricingData)
  });
}));

// Get Super Agent pricing table
router.get('/super-agent-rates', authenticateToken, asyncHandler(async (req, res) => {
  // Import constants dynamically
  let constants;
  try {
    constants = await import('../constants.js');
  } catch (error) {
    constants = {
      SUPER_AGENT_PRICING_TABLE: [],
      WORKER_PAY_RATE_PER_500_WORDS: 6.25
    };
  }

  res.json({
    success: true,
    data: {
      pricing_table: constants.SUPER_AGENT_PRICING_TABLE || [],
      urgency_rates: PricingService.URGENCY_PRICING,
      super_worker_rate: constants.WORKER_PAY_RATE_PER_500_WORDS || 6.25
    }
  });
}));

// Calculate Super Worker earnings
router.post('/super-worker-earnings', authenticateToken, asyncHandler(async (req, res) => {
  const { wordCount } = req.body;

  if (!wordCount || wordCount <= 0) {
    throw createValidationError('Valid word count is required');
  }

  const earnings = PricingService.calculateSuperWorkerEarnings(wordCount);
  
  res.json({
    success: true,
    data: earnings
  });
}));

// Get pricing type for a client
router.get('/client-pricing-type/:clientId', authenticateToken, asyncHandler(async (req, res) => {
  const { clientId } = req.params;
  
  const pricingInfo = await PricingService.determinePricingType(clientId);
  
  res.json({
    success: true,
    data: pricingInfo
  });
}));

// Validate pricing request
router.post('/validate', authenticateToken, asyncHandler(async (req, res) => {
  const { wordCount, deadline } = req.body;
  
  const deadlineDate = deadline ? new Date(deadline) : null;
  const validation = PricingService.validatePricingRequest(wordCount, deadlineDate);
  
  res.json({
    success: true,
    data: validation
  });
}));

export default router;