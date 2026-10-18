use atlas_core::Atlas;

pub struct SyncBoundary;

impl SyncBoundary {
    pub fn local_only() -> Atlas {
        Atlas::default()
    }
}
