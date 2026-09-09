#[cfg(windows)]
pub mod windows;
#[cfg(windows)]
pub type TunManager = windows::WindowsTunManager;

#[cfg(not(windows))]
pub mod stub;
#[cfg(not(windows))]
pub type TunManager = stub::StubTunManager;
