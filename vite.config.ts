import path from 'path';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      server: {
        fs: {
          allow: ['..']
        },
        host: true,
        port: 5173
      },
      preview: {
        host: true,
        port: 3000
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        chunkSizeWarningLimit: 1000, // Increase warning limit to 1MB
        rollupOptions: {
          output: {
            manualChunks: {
              // Vendor chunks
              'vendor-react': ['react', 'react-dom'],
              'vendor-ui': ['lucide-react'],
              
              // Dashboard chunks (lazy loaded)
              'dashboard-super-agent': [
                './components/dashboard/SuperAgentDashboard.tsx',
                './components/dashboard/SuperAgentAnalytics.tsx',
                './components/dashboard/SystemBroadcast.tsx'
              ],
              'dashboard-agent': [
                './components/dashboard/AgentDashboard.tsx',
                './components/dashboard/AgentManagement.tsx',
                './components/dashboard/AgentPricingConfig.tsx'
              ],
              'dashboard-worker': [
                './components/dashboard/WorkerDashboard.tsx',
                './components/dashboard/SuperWorkerDashboard.tsx'
              ],
              'dashboard-client': [
                './components/dashboard/ClientDashboard.tsx'
              ],
              
              // Feature chunks
              'hierarchy-operations': [
                './components/common/HierarchyFormValidation.tsx',
                './components/dashboard/HierarchyOverview.tsx'
              ],
              'notifications': [
                './components/dashboard/NotificationCenter.tsx',
                './components/dashboard/NotificationManager.tsx',
                './components/notifications/NotificationBell.tsx'
              ],
              'financial': [
                './components/dashboard/FinancialSecurityDashboard.tsx'
              ],
              'project-management': [
                './components/dashboard/ProjectAssignmentManager.tsx',
                './components/modals/ProjectDetailModal.tsx'
              ]
            }
          }
        }
      }
    };
});
