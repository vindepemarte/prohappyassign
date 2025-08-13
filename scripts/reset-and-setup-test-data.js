#!/usr/bin/env node

/**
 * Reset Database and Create Test Data
 * This script clears all data and creates test users with reference codes
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });
dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function resetAndSetupTestData() {
    console.log('🚀 Starting database reset and test data setup...');
    console.log('============================================================');

    try {
        // 1. Clear all existing data
        console.log('🗑️  Step 1: Clearing existing data...');
        
        // Disable triggers temporarily
        await pool.query('SET session_replication_role = replica');
        
        await pool.query('TRUNCATE TABLE notification_history CASCADE');
        await pool.query('TRUNCATE TABLE financial_access_audit CASCADE');
        await pool.query('TRUNCATE TABLE agent_pricing_history CASCADE');
        await pool.query('TRUNCATE TABLE agent_pricing CASCADE');
        await pool.query('TRUNCATE TABLE project_assignment_history CASCADE');
        await pool.query('TRUNCATE TABLE projects CASCADE');
        await pool.query('TRUNCATE TABLE reference_codes CASCADE');
        await pool.query('TRUNCATE TABLE user_hierarchy CASCADE');
        await pool.query('TRUNCATE TABLE users CASCADE');
        
        // Re-enable triggers
        await pool.query('SET session_replication_role = DEFAULT');
        
        console.log('✅ All existing data cleared');

        // 2. Create test users with password '123456'
        console.log('👥 Step 2: Creating test users...');
        
        const hashedPassword = await bcrypt.hash('123456', 12);
        
        // Create Super Agent
        const superAgentResult = await pool.query(`
            INSERT INTO users (id, email, password_hash, full_name, role, created_at)
            VALUES (gen_random_uuid(), 'superagent@test.com', $1, 'Super Agent Test', 'super_agent', NOW())
            RETURNING id, email, full_name, role
        `, [hashedPassword]);
        const superAgent = superAgentResult.rows[0];
        console.log(`✅ Created Super Agent: ${superAgent.email}`);

        // Create hierarchy for Super Agent
        await pool.query(`
            INSERT INTO user_hierarchy (user_id, parent_id, super_agent_id, hierarchy_level, created_at)
            VALUES ($1, NULL, $1, 1, NOW())
        `, [superAgent.id]);

        // Create Agent
        const agentResult = await pool.query(`
            INSERT INTO users (id, email, password_hash, full_name, role, created_at)
            VALUES (gen_random_uuid(), 'agent@test.com', $1, 'Agent Test', 'agent', NOW())
            RETURNING id, email, full_name, role
        `, [hashedPassword]);
        const agent = agentResult.rows[0];
        console.log(`✅ Created Agent: ${agent.email}`);

        // Create hierarchy for Agent
        await pool.query(`
            INSERT INTO user_hierarchy (user_id, parent_id, super_agent_id, hierarchy_level, created_at)
            VALUES ($1, $2, $2, 2, NOW())
        `, [agent.id, superAgent.id]);

        // Create Super Worker
        const superWorkerResult = await pool.query(`
            INSERT INTO users (id, email, password_hash, full_name, role, created_at)
            VALUES (gen_random_uuid(), 'superworker@test.com', $1, 'Super Worker Test', 'super_worker', NOW())
            RETURNING id, email, full_name, role
        `, [hashedPassword]);
        const superWorker = superWorkerResult.rows[0];
        console.log(`✅ Created Super Worker: ${superWorker.email}`);

        // Create hierarchy for Super Worker
        await pool.query(`
            INSERT INTO user_hierarchy (user_id, parent_id, super_agent_id, hierarchy_level, created_at)
            VALUES ($1, $2, $3, 3, NOW())
        `, [superWorker.id, agent.id, superAgent.id]);

        // Create Worker
        const workerResult = await pool.query(`
            INSERT INTO users (id, email, password_hash, full_name, role, created_at)
            VALUES (gen_random_uuid(), 'worker@test.com', $1, 'Worker Test', 'worker', NOW())
            RETURNING id, email, full_name, role
        `, [hashedPassword]);
        const worker = workerResult.rows[0];
        console.log(`✅ Created Worker: ${worker.email}`);

        // Create hierarchy for Worker
        await pool.query(`
            INSERT INTO user_hierarchy (user_id, parent_id, super_agent_id, hierarchy_level, created_at)
            VALUES ($1, $2, $3, 4, NOW())
        `, [worker.id, superWorker.id, superAgent.id]);

        // Create Client
        const clientResult = await pool.query(`
            INSERT INTO users (id, email, password_hash, full_name, role, created_at)
            VALUES (gen_random_uuid(), 'client@test.com', $1, 'Client Test', 'client', NOW())
            RETURNING id, email, full_name, role
        `, [hashedPassword]);
        const client = clientResult.rows[0];
        console.log(`✅ Created Client: ${client.email}`);

        // Create hierarchy for Client
        await pool.query(`
            INSERT INTO user_hierarchy (user_id, parent_id, super_agent_id, hierarchy_level, created_at)
            VALUES ($1, $2, $3, 3, NOW())
        `, [client.id, agent.id, superAgent.id]);

        // 3. Create reference codes
        console.log('🔗 Step 3: Creating reference codes...');

        // Super Agent codes for recruiting agents
        await pool.query(`
            INSERT INTO reference_codes (code, owner_id, code_type, is_active, created_at)
            VALUES ('SAGNT', $1, 'agent_recruitment', true, NOW())
        `, [superAgent.id]);
        console.log('✅ Created reference code: SAGNT (for agent recruitment)');

        // Agent codes for recruiting clients
        await pool.query(`
            INSERT INTO reference_codes (code, owner_id, code_type, is_active, created_at)
            VALUES ('AGCLI', $1, 'client_recruitment', true, NOW())
        `, [agent.id]);
        console.log('✅ Created reference code: AGCLI (for client recruitment)');

        // Agent codes for recruiting super workers
        await pool.query(`
            INSERT INTO reference_codes (code, owner_id, code_type, is_active, created_at)
            VALUES ('AGSWK', $1, 'worker_recruitment', true, NOW())
        `, [agent.id]);
        console.log('✅ Created reference code: AGSWK (for super worker recruitment)');

        // Super Worker codes for recruiting workers
        await pool.query(`
            INSERT INTO reference_codes (code, owner_id, code_type, is_active, created_at)
            VALUES ('SWWRK', $1, 'worker_recruitment', true, NOW())
        `, [superWorker.id]);
        console.log('✅ Created reference code: SWWRK (for worker recruitment)');

        // 4. Create agent pricing for the agent
        console.log('💰 Step 4: Setting up agent pricing...');
        
        await pool.query(`
            INSERT INTO agent_pricing (agent_id, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, created_at, updated_at)
            VALUES ($1, 500, 15000, 7.50, 18.00, NOW(), NOW())
        `, [agent.id]);
        console.log('✅ Created agent pricing configuration');

        // 5. Create a sample project
        console.log('📋 Step 5: Creating sample project...');
        
        await pool.query(`
            INSERT INTO projects (client_id, agent_id, worker_id, title, description, status, initial_word_count, cost_gbp, created_at)
            VALUES ($1, $2, $3, 'Sample Test Project', 'This is a test project for workflow testing', 'in_progress', 1000, 15.00, NOW())
        `, [client.id, agent.id, worker.id]);
        console.log('✅ Created sample project');

        // 6. Summary
        console.log('');
        console.log('🎉 DATABASE SETUP COMPLETE!');
        console.log('============================================================');
        console.log('');
        console.log('📋 TEST USERS CREATED (all with password: 123456):');
        console.log('');
        console.log('🔴 Super Agent: superagent@test.com');
        console.log('   - Full system access');
        console.log('   - Can manage all users and view all data');
        console.log('');
        console.log('🔵 Agent: agent@test.com');
        console.log('   - Manages clients and workers');
        console.log('   - Has pricing configuration');
        console.log('');
        console.log('🟡 Super Worker: superworker@test.com');
        console.log('   - Assigns projects to workers');
        console.log('   - Under the agent');
        console.log('');
        console.log('🟢 Worker: worker@test.com');
        console.log('   - Executes assigned projects');
        console.log('   - Under the super worker');
        console.log('');
        console.log('🟣 Client: client@test.com');
        console.log('   - Submits projects');
        console.log('   - Under the agent');
        console.log('');
        console.log('🔗 REFERENCE CODES FOR TESTING:');
        console.log('');
        console.log('   SAGNT - Super Agent code (for recruiting agents)');
        console.log('   AGCLI - Agent code (for recruiting clients)');
        console.log('   AGSWK - Agent code (for recruiting super workers)');
        console.log('   SWWRK - Super Worker code (for recruiting workers)');
        console.log('');
        console.log('🚀 READY FOR TESTING!');
        console.log('   1. Try logging in with any of the test accounts');
        console.log('   2. Try registering new users with the reference codes');
        console.log('   3. Test the hierarchy and role-based features');
        console.log('');

    } catch (error) {
        console.error('❌ Error setting up test data:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the setup
resetAndSetupTestData().catch(console.error);