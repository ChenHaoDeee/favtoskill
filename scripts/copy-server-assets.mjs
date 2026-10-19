import { cpSync,mkdirSync } from 'node:fs';
mkdirSync('dist-server/server/fixtures',{recursive:true});
cpSync('server/fixtures','dist-server/server/fixtures',{recursive:true});
