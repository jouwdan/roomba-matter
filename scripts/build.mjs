import {access, cp, rm} from 'node:fs/promises';

const source = new URL('../src/', import.meta.url);
const output = new URL('../dist/', import.meta.url);
await access(new URL('index.html', source));
await rm(output, {recursive: true, force: true});
await cp(source, output, {recursive: true});
console.log('Built static site in dist/');
