// Product programs perform local computation only. Loaded before any bundled code.
import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dgram from 'node:dgram';
import dns from 'node:dns';
import {syncBuiltinESMExports} from 'node:module';

function blocked() { throw new Error('PRODUCT_NETWORK_FORBIDDEN'); }
net.connect = net.createConnection = blocked;
net.Socket.prototype.connect = blocked;
tls.connect = blocked;
http.request = http.get = https.request = https.get = blocked;
dgram.createSocket = blocked;
dns.lookup = dns.resolve = blocked;
globalThis.fetch = blocked;
syncBuiltinESMExports();
