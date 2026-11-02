// Copy an identified standalone release into the isolated Connect demonstration.
// The authenticated candidate has extra proof hooks and must be rebased explicitly.
import {readFileSync,writeFileSync,readdirSync,mkdirSync,realpathSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const target=path.join(root,'apps/GRAN-abaque-m-1');
const args=process.argv.slice(2),write=args.includes('--write');
const source=realpathSync(path.resolve(args.find(arg=>!arg.startsWith('--'))||path.join(root,'../GRAN-abaque-m-1')));
const git=(...command)=>execFileSync('git',['-C',source,...command],{encoding:'utf8'}).trim();
if(git('status','--porcelain'))throw Error('Commit the standalone source before synchronizing it.');
const commit=git('rev-parse','--verify','HEAD^{commit}');
const origin=new URL(git('remote','get-url','origin'));
const repository=origin.pathname.replace(/^\//,'').replace(/\.git$/,'');
if(origin.hostname!=='github.com'||!['Mr-Tat/abaque-m-1','Mr-Tat/GRAN-abaque-m-1'].includes(repository))throw Error('Unexpected standalone source repository.');
const previous=JSON.parse(readFileSync(path.join(target,'source-manifest.json'),'utf8'));
if(previous.connectEnabled)throw Error('Rebase the authenticated adapter; do not overwrite its proof hooks.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const files=['index.html','abaque.css','demo-controls.mjs','xp-hints.mjs'];
function assets(folder){
 for(const entry of readdirSync(path.join(source,folder),{withFileTypes:true})){
  const name=folder+'/'+entry.name;
  if(entry.isSymbolicLink())throw Error('Source assets must be regular files.');
  if(entry.isDirectory())assets(name);else files.push(name);
 }
}
assets('assets');
const contents=new Map(files.map(file=>[file,readFileSync(path.join(source,file))]));
contents.set('game-original.html',contents.get('index.html'));
contents.set('environment.js',Buffer.from('// Connect Laboratory: the standalone engine uses a separate demo namespace.\nwindow.MATHAS_ABAQUE_ENV=Object.freeze({laboratory:true});\n'));
const manifest={
 sourceRepository:repository,repositoryDisplayName:'GRAN-abaque-m-1',sourceCommit:commit,
 sourceSha256:hash(contents.get('game-original.html')),
 baselineSourceCommit:previous.baselineSourceCommit||previous.sourceCommit,
 baselineSourceSha256:previous.baselineSourceSha256||previous.sourceSha256,
 appKey:'abaque-longueurs',status:'isolated-demo',connectEnabled:false,
 sourceFiles:Object.fromEntries(files.map(file=>[file,hash(contents.get(file))])),
 changes:['Versioned copy of the standalone GRAN-abaque-m-1 application','Laboratory environment adapter; historical app_key and demo storage preserved'],
 license:'Copied with repository owner authorization in this task'
};
contents.set('source-manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
const changed=[];
for(const [file,bytes] of contents){
 const destination=path.join(target,file);
 let same=false;try{same=readFileSync(destination).equals(bytes);}catch{}
 if(same)continue;
 changed.push(file);
 if(write){mkdirSync(path.dirname(destination),{recursive:true});writeFileSync(destination,bytes);}
}
console.log(JSON.stringify({source:repository,commit,mode:write?'write':'check',changed},null,2));
if(changed.length&&!write)process.exitCode=1;
