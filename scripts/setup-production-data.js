#!/usr/bin/env node

/**
 * Setup Production Data
 * This script sets up the production database with test data
 * Run this ONLY ONCE after deploying to production
 */

import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: false
});

async function setupProductionData() {
    console.log('🚀 Setting up production data...');
    console.log('============================================================');

    try {
        // Check if users already exist
        const existingUsers = await pool.query('SELECT COUNT(*) FROM users');
        const userCount = parseInt(existingUsers.rows[0].count);
        
        if (userCount > 0) {
            console.log(`⚠️  Database already has ${userCount} users. Skipping setup.`);
            console.log('If you want to reset the database, run the reset script first.');
            return;
        }

        console.log('📋 Creating production test users...');
        
        const hashedPassword = await bcrypt.hash('123456', 12);
        
        // Create Super Agent
        const superAgentResult = await pool.query(`
            INSERT INTO users (id, email, password_hash, full_name, role, created_at)
            VALUES (gen_random_uuid(), 'admin@prohappya.uk', $1, 'System Administrator', 'super_agent', NOW())
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
            VALUES (gen_random_uuid(), 'agent@prohappya.uk', $1, 'Test Agent', 'agent', NOW())
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
            VALUES (gen_random_uuid(), 'superworker@prohappya.uk', $1, 'Test Super Worker', 'super_worker', NOW())
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
            VALUES (gen_random_uuid(), 'worker@prohappya.uk', $1, 'Test Worker', 'worker', NOW())
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
            VALUES (gen_random_uuid(), 'client@prohappya.uk', $1, 'Test Client', 'client', NOW())
            RETURNING id, email, full_name, role
        `, [hashedPassword]);
        const client = clientResult.rows[0];
        console.log(`✅ Created Client: ${client.email}`);

        // Create hierarchy for Client
        await pool.query(`
            INSERT INTO user_hierarchy (user_id, parent_id, super_agent_id, hierarchy_level, created_at)
            VALUES ($1, $2, $3, 3, NOW())
        `, [client.id, agent.id, superAgent.id]);

        // Create reference codes
        console.log('🔗 Creating reference codes...');

        await pool.query(`
            INSERT INTO reference_codes (code, owner_id, code_type, is_active, created_at)
            VALUES 
                ('ADMIN', $1, 'agent_recruitment', true, NOW()),
                ('AGENT', $2, 'client_recruitment', true, NOW()),
                ('SUPER', $2, 'worker_recruitment', true, NOW()),
                ('WORK1', $3, 'worker_recruitment', true, NOW())
        `, [superAgent.id, agent.id, superWorker.id]);
        console.log('✅ Created reference codes: ADMIN, AGENT, SUPER, WORK1');

        // Create agent pricing
        console.log('💰 Setting up agent pricing...');
        
        await pool.query(`
            INSERT INTO agent_pricing (agent_id, min_word_count, max_word_count, base_rate_per_500_words, agent_fee_percentage, created_at, updated_at)
            VALUES ($1, 500, 15000, 7.50, 18.00, NOW(), NOW())
        `, [agent.id]);
        console.log('✅ Created agent pricing configuration');

        console.log('');
        console.log('🎉 PRODUCTION SETUP COMPLETE!');
        console.log('============================================================');
        console.log('');
        console.log('📋 PRODUCTION USERS CREATED (all with password: 123456):');
        console.log('');
        console.log('🔴 Super Agent: admin@prohappya.uk');
        console.log('🔵 Agent: agent@prohappya.uk');
        console.log('🟡 Super Worker: superworker@prohappya.uk');
        console.log('🟢 Worker: worker@prohappya.uk');
        console.log('🟣 Client: client@prohappya.uk');
        console.log('');
        console.log('🔗 REFERENCE CODES:');
        console.log('   ADMIN - Super Agent code (for recruiting agents)');
        console.log('   AGENT - Agent code (for recruiting clients)');
        console.log('   SUPER - Agent code (for recruiting super workers)');
        console.log('   WORK1 - Super Worker code (for recruiting workers)');
        console.log('');
        console.log('🚀 READY FOR PRODUCTION USE!');

    } catch (error) {
        console.error('❌ Error setting up production data:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

// Run the setup
setupProductionData().catch(console.error);