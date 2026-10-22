import { build } from 'esbuild';
import fs from 'node:fs';
await build({stdin:{contents:'export { createClient } from "@supabase/supabase-js";',resolveDir:process.cwd()},bundle:true,format:'esm',platform:'browser',target:['es2022'],minify:true,legalComments:'eof',outfile:'cms/vendor/supabase.js'});
fs.copyFileSync('node_modules/@supabase/supabase-js/LICENSE','cms/vendor/SUPABASE-LICENSE');
console.log('Supabase JS v2.118.0 bundled locally. No runtime Node server is required.');
