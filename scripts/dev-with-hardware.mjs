// Start the optional Linux USB bridge alongside the development server.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
const vite=fileURLToPath(new URL('../node_modules/vite/bin/vite.js',import.meta.url))
const bridge=fileURLToPath(new URL('./hardware-bridge.mjs',import.meta.url))
const game=spawn(process.execPath,[vite,...process.argv.slice(2)],{stdio:'inherit'})
const hardware=process.platform==='linux'?spawn(process.execPath,[bridge],{stdio:'inherit'}):null
const stop=()=>{hardware?.kill();game.kill()}
process.on('SIGINT',stop);process.on('SIGTERM',stop)
game.on('exit',(code,signal)=>{hardware?.kill();process.exit(signal?0:code??1)})
