'use strict';

process.env.PREPARE_RUNTIME_ACCEPTANCE = 'true';
require('../../runtimeAcceptance');
console.log('Runtime acceptance schema and operator are current.');
