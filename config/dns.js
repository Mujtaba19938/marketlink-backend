import dns from 'dns'

// "mongodb+srv://" needs a DNS SRV lookup, which some routers/ISPs refuse (querySrv ECONNREFUSED).
// Point Node at public DNS for that. Set DNS_SERVERS=system in .env to use the OS default instead.
const servers = (process.env.DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean)

if ((process.env.MONGO_URI || '').startsWith('mongodb+srv://') && servers[0] !== 'system') {
    dns.setServers(servers)
    dns.promises.setServers(servers)
}