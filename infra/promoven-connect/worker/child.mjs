import {normalize} from './normalize.mjs';
try{const chunks=[];let size=0;for await(const chunk of process.stdin){size+=chunk.length;if(size>5242880)throw Error();chunks.push(chunk);}process.stdout.write(await normalize(Buffer.concat(chunks),process.argv[2]));}catch{process.exitCode=1;}
