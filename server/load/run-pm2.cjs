process.env.PROFILE_PM2='1';
if(process.argv.includes('--sweep'))process.env.PM2_SWEEP='1';
require('./profile-local.cjs');
