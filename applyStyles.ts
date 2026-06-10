import fs from 'fs';

let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacements = [
  [/bg-slate-950/g, 'bg-slate-50 dark:bg-slate-950'],
  [/(?<!-)bg-slate-900/g, 'bg-white dark:bg-slate-900'],
  [/(?<!-)bg-slate-800/g, 'bg-slate-100 dark:bg-slate-800'],
  [/border-slate-800/g, 'border-slate-200 dark:border-slate-800'],
  [/border-slate-700/g, 'border-slate-300 dark:border-slate-700'],
  [/text-slate-400/g, 'text-slate-500 dark:text-slate-400'],
  [/text-slate-300/g, 'text-slate-600 dark:text-slate-300'],
  [/(?<!-)text-white/g, 'text-slate-900 dark:text-white']
];

for (const [regex, replacement] of replacements) {
  code = code.replace(regex, replacement);
}

fs.writeFileSync('src/App.tsx', code);
console.log('Styles updated in App.tsx');
