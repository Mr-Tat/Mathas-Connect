// Loopback relay to a LOCAL internal Docker network (no external forwarding).
import http from 'node:http';
const [target,port]=process.argv.slice(2);
if(!/^(172\.(1[6-9]|2\d|3[01])|10\.\d+)\.\d+\.\d+$/.test(target)||!/^\d+$/.test(port))throw Error('local_docker_target_required');
http.createServer((req,res)=>{const out=http.request({hostname:target,port:8000,path:req.url,method:req.method,headers:req.headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});out.on('error',()=>{res.writeHead(502);res.end('local lab unavailable')});req.pipe(out)}).listen(Number(port),'127.0.0.1');
