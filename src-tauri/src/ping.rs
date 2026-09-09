use std::net::SocketAddr;
use std::time::{Duration, Instant};
use tokio::net::{lookup_host, TcpStream};
use tokio::time::timeout;

pub struct PingEngine;

impl PingEngine {
    pub async fn test_latency(host: &str, port: u16, timeout_ms: u64) -> i64 {
        let addr_str = format!("{}:{}", host, port);
        let mut socket_addrs: Vec<SocketAddr> = match lookup_host(&addr_str).await {
            Ok(addrs) => addrs.collect(),
            Err(_) => return -1,
        };

        if socket_addrs.is_empty() {
            return -1;
        }

        // Prioritize IPv4 to eliminate long dual-stack IPv6 timeout hangs on cellular/ISP networks
        socket_addrs.sort_by_key(|a| if a.is_ipv4() { 0 } else { 1 });

        let start = Instant::now();
        let connect_fut = TcpStream::connect(&socket_addrs[0]);

        match timeout(Duration::from_millis(timeout_ms), connect_fut).await {
            Ok(Ok(stream)) => {
                let _ = stream.set_nodelay(true);
                start.elapsed().as_millis() as i64
            }
            _ => -1,
        }
    }
}
