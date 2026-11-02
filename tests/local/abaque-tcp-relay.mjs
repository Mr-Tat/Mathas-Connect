import net from 'node:net';
const [target,remotePort,port]=process.argv.slice(2);
if(!net.isIP(target)||!/^\d+$/.test(remotePort)||!/^\d+$/.test(port))throw Error('local_relay_arguments');
const server=net.createServer(socket=>{
 const upstream=net.connect({host:target,port:Number(remotePort)});
 socket.pipe(upstream);upstream.pipe(socket);
 socket.on('error',()=>upstream.destroy());upstream.on('error',()=>socket.destroy());
});
server.listen(Number(port),'127.0.0.1');
process.on('SIGTERM',()=>server.close(()=>process.exit(0)));
