console.log('Test 1: Script started');

try {
  console.log('Test 2: Loading dotenv...');
  require('dotenv').config({ path: './backend/.env' });
  console.log('Test 3: Dotenv loaded');
  
  console.log('Test 4: Loading orchestrator...');
  const { generateCompleteRecommendations } = require('./analyzers/recommendation-generator');
  console.log('Test 5: Orchestrator loaded');
  
  console.log('✅ All imports successful!');
} catch (error) {
  console.error('❌ Import failed:', error);
  console.error(error.stack);
}