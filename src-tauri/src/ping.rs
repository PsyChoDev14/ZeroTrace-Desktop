use std::net::{SocketAddr, ToSocketAddrs};
use std::time::{Duration, Instant};
use tokio::net::TcpStream;
use tokio::time::timeout;

pub struct PingEngine;

impl PingEngine {
    pub async fn test_latency(host: &str, port: u16, timeout_ms: u64) -> i64 {
        let addr_str = format!("{}:{}", host, port);
        let socket_addrs: Vec<SocketAddr> = match addr_str.to_socket_addrs() {
            Ok(addrs) => addrs.collect(),
            Err(_) => return -1,
        };

        if socket_addrs.is_empty() {
            return -1;
        }

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
