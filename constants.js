export const WHATSAPP_SUPPORT_NUMBER = "447586369924";

export const COLORS = {
  blue: '#4A90E2',
  yellow: '#F5A623',
  red: '#D0021B',
  white: '#FFFFFF',
  lightGray: '#F7F7F7',
  borderGray: '#E5E5E5',
  textGray: '#777777',
  darkGray: '#4B4B4B',
  background: '#f0f2f5',
  success: '#28a745',
};

// Super Agent pricing table in GBP (£) based on word count - FIXED RATES
export const SUPER_AGENT_PRICING_TABLE = [
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
    { maxWords: 10000, price: 240 },
    { maxWords: 10500, price: 250 },
    { maxWords: 11000, price: 260 },
    { maxWords: 11500, price: 270 },
    { maxWords: 12000, price: 280 },
    { maxWords: 12500, price: 290 },
    { maxWords: 13000, price: 300 },
    { maxWords: 13500, price: 310 },
    { maxWords: 14000, price: 320 },
    { maxWords: 14500, price: 330 },
    { maxWords: 15000, price: 340 },
    { maxWords: 15500, price: 350 },
    { maxWords: 16000, price: 360 },
    { maxWords: 16500, price: 370 },
    { maxWords: 17000, price: 380 },
    { maxWords: 17500, price: 390 },
    { maxWords: 18000, price: 400 },
    { maxWords: 18500, price: 410 },
    { maxWords: 19000, price: 420 },
    { maxWords: 19500, price: 430 },
    { maxWords: 20000, price: 440 },
];

// Legacy pricing table (for backward compatibility)
export const PRICING_TABLE = SUPER_AGENT_PRICING_TABLE;

// NOTE: This is a hardcoded exchange rate. In a production environment,
// this should be fetched from a reliable currency conversion API.
export const GBP_TO_INR_RATE = 105.50;

// Payout rate for workers in GBP (£)
export const WORKER_PAY_RATE_PER_500_WORDS = 6.25;