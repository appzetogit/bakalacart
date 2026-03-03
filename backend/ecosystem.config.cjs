module.exports = {
    apps: [
        {
            name: 'bakalaa-backend',
            script: 'server.js',
            interpreter: 'node',
            watch: false,                     // File watch band - production mein nahi chahiye
            max_memory_restart: '500M',       // Memory 500MB se zyada ho toh auto-restart
            restart_delay: 3000,             // Crash ke 3 second baad restart
            max_restarts: 10,                // 10 baar tak auto-restart karega
            min_uptime: '10s',               // 10 second se zyada chala toh "stable" maana jaayega
            autorestart: true,               // Crash hone pe automatic restart
            exp_backoff_restart_delay: 100,  // Backoff delay for restarts
            env: {
                NODE_ENV: 'production',
                PORT: 5000
            },
            error_file: './logs/pm2-error.log',
            out_file: './logs/pm2-out.log',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true
        }
    ]
};
