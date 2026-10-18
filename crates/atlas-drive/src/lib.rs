use atlas_core::Atlas;

pub struct DriveBoundary;

impl DriveBoundary {
    pub fn not_connected_yet() -> Atlas {
        Atlas::default()
    }
}
