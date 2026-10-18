use atlas_core::{Atlas, SCHEMA_VERSION};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Serialize)]
pub struct ExportEnvelope {
    #[serde(rename = "schemaVersion")]
    pub schema_version: u32,
    pub nodes: Vec<serde_json::Value>,
    pub edges: Vec<serde_json::Value>,
}

pub fn current_schema_version() -> u32 {
    SCHEMA_VERSION
}

pub fn encode_empty_atlas() -> Result<String, serde_json::Error> {
    let _ = Atlas::default();
    serde_json::to_string(&ExportEnvelope {
        schema_version: SCHEMA_VERSION,
        nodes: Vec::new(),
        edges: Vec::new(),
    })
}
