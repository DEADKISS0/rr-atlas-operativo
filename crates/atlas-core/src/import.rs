use std::collections::HashMap;

use serde_json::Value;
use thiserror::Error;
use time::OffsetDateTime;
use uuid::Uuid;

use crate::model::{
    Atlas, Edge, EdgeId, EdgeKind, KindFields, Node, NodeId, NodeKind, PersonId, Pos, Resource,
    ResourceKind, Validation,
};
use crate::resource_url::{ResourceUrl, UrlError};
use crate::validate::{IntegrityIssue, validate};

const IMPORT_NAMESPACE: Uuid = Uuid::from_u128(0x9d8f_36d0_1ad0_4a44_8c3c_5c2d_2f11_a001);

#[derive(Debug, Error)]
pub enum ImportError {
    #[error("JSON inválido: {0}")]
    Json(#[from] serde_json::Error),
    #[error("schemaVersion no soportado: {0}")]
    UnsupportedSchema(u64),
    #[error("estructura inválida: {0}")]
    Invalid(String),
    #[error("recurso inseguro en el nodo {node}: {source}")]
    UnsafeResource { node: String, source: UrlError },
}

#[derive(Debug)]
pub struct ImportReport {
    pub schema_version: u32,
    pub atlas: Atlas,
    pub issues: Vec<IntegrityIssue>,
    pub warnings: Vec<String>,
}

impl ImportReport {
    pub fn has_audit_code(&self, code: &str) -> bool {
        self.issues
            .iter()
            .any(|issue| issue.code.audit_id() == code)
    }
}

pub fn import_json(input: &str) -> Result<ImportReport, ImportError> {
    let document: Value = serde_json::from_str(input)?;
    let schema_version = document
        .get("schemaVersion")
        .and_then(Value::as_u64)
        .unwrap_or(1);
    if schema_version != 1 {
        return Err(ImportError::UnsupportedSchema(schema_version));
    }

    let nodes_value = document
        .get("nodes")
        .or_else(|| document.get("data"))
        .and_then(Value::as_array)
        .ok_or_else(|| ImportError::Invalid("falta nodes/data".to_owned()))?;
    let edges_value = document
        .get("edges")
        .or_else(|| document.get("lines"))
        .and_then(Value::as_array)
        .ok_or_else(|| ImportError::Invalid("falta edges/lines".to_owned()))?;

    let mut warnings = Vec::new();
    let mut node_ids = HashMap::new();
    let mut nodes = Vec::with_capacity(nodes_value.len());

    for (index, raw_node) in nodes_value.iter().enumerate() {
        let object = raw_node
            .as_object()
            .ok_or_else(|| ImportError::Invalid(format!("nodo {index} no es objeto")))?;
        let legacy_id = required_string(object.get("id"), &format!("nodo {index}.id"))?;
        let title = required_string(object.get("title"), &format!("nodo {index}.title"))?;
        let legacy_kind = optional_string(object.get("type")).unwrap_or_else(|| "Otro".to_owned());
        let kind = NodeKind::from_legacy(&legacy_kind);
        if matches!(kind, NodeKind::Other) && !legacy_kind.eq_ignore_ascii_case("otro") {
            warnings.push(format!("tipo no reconocido en {legacy_id}: {legacy_kind}"));
        }

        let id = NodeId(stable_uuid("node", &legacy_id));
        node_ids.insert(legacy_id.clone(), id);
        let owner = optional_owner(object.get("owner"));
        let status = optional_string(object.get("status")).unwrap_or_default();
        let validation = validation_from_legacy(&status);
        let summary = optional_string(object.get("desc"))
            .or_else(|| optional_string(object.get("summary")))
            .unwrap_or_default();
        let x = number(object.get("x")).unwrap_or(0.0);
        let y = number(object.get("y")).unwrap_or(0.0);
        let resources = parse_resources(object, &legacy_id)?;
        let fields = if kind == NodeKind::Prospect {
            KindFields::Prospect {
                stage: status.clone(),
                monthly_cop: None,
                next_meeting: None,
            }
        } else {
            KindFields::None
        };

        nodes.push(Node {
            id,
            kind,
            title,
            summary,
            owner,
            validation,
            pos: Pos { x, y },
            resources,
            fields,
            updated_at: OffsetDateTime::UNIX_EPOCH,
        });
    }

    let mut edges = Vec::with_capacity(edges_value.len());
    for (index, raw_edge) in edges_value.iter().enumerate() {
        let (from, to, label) = parse_edge(raw_edge).ok_or_else(|| {
            ImportError::Invalid(format!("conexión {index} debe ser [from, to] o un objeto"))
        })?;
        edges.push(Edge {
            id: EdgeId(stable_uuid("edge", &format!("{from}:{to}:{index}"))),
            from: NodeId(stable_uuid("node", &from)),
            to: NodeId(stable_uuid("node", &to)),
            kind: EdgeKind::Flow,
            label,
        });
    }

    let atlas = Atlas { nodes, edges };
    let issues = validate(&atlas);
    Ok(ImportReport {
        schema_version: schema_version as u32,
        atlas,
        issues,
        warnings,
    })
}

fn parse_resources(
    object: &serde_json::Map<String, Value>,
    node: &str,
) -> Result<Vec<Resource>, ImportError> {
    let mut resources = Vec::new();
    if let Some(links) = object.get("links").and_then(Value::as_array) {
        for (index, link) in links.iter().enumerate() {
            let Some(values) = link.as_array() else {
                return Err(ImportError::Invalid(format!(
                    "link {node}/{index} no es par"
                )));
            };
            let label = values.first().and_then(Value::as_str).unwrap_or("Recurso");
            let raw_url = values.get(1).and_then(Value::as_str).ok_or_else(|| {
                ImportError::Invalid(format!("URL ausente en link {node}/{index}"))
            })?;
            resources.push(Resource {
                label: label.to_owned(),
                url: ResourceUrl::parse(raw_url).map_err(|source| ImportError::UnsafeResource {
                    node: node.to_owned(),
                    source,
                })?,
                kind: ResourceKind::Link,
            });
        }
    }
    if let Some(media) = object.get("media").and_then(Value::as_array) {
        for (index, item) in media.iter().enumerate() {
            let Some(media_object) = item.as_object() else {
                return Err(ImportError::Invalid(format!(
                    "media {node}/{index} no es objeto"
                )));
            };
            let label =
                optional_string(media_object.get("label")).unwrap_or_else(|| "Recurso".to_owned());
            let raw_url = required_string(
                media_object.get("url"),
                &format!("media {node}/{index}.url"),
            )?;
            resources.push(Resource {
                label,
                url: ResourceUrl::parse(&raw_url).map_err(|source| {
                    ImportError::UnsafeResource {
                        node: node.to_owned(),
                        source,
                    }
                })?,
                kind: resource_kind(optional_string(media_object.get("kind"))),
            });
        }
    }
    Ok(resources)
}

fn parse_edge(raw: &Value) -> Option<(String, String, Option<String>)> {
    if let Some(values) = raw.as_array() {
        let from = values.first()?.as_str()?.to_owned();
        let to = values.get(1)?.as_str()?.to_owned();
        return Some((from, to, None));
    }
    let object = raw.as_object()?;
    let from = object.get("from")?.as_str()?.to_owned();
    let to = object.get("to")?.as_str()?.to_owned();
    let label = optional_string(object.get("label"));
    Some((from, to, label))
}

fn required_string(value: Option<&Value>, field: &str) -> Result<String, ImportError> {
    value
        .and_then(Value::as_str)
        .map(str::to_owned)
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| ImportError::Invalid(format!("{field} ausente o vacío")))
}

fn optional_string(value: Option<&Value>) -> Option<String> {
    value.and_then(Value::as_str).map(str::to_owned)
}

fn number(value: Option<&Value>) -> Option<f32> {
    value
        .and_then(Value::as_f64)
        .map(|value| value as f32)
        .filter(|value| value.is_finite())
}

fn optional_owner(value: Option<&Value>) -> Option<PersonId> {
    let owner = optional_string(value)?;
    if owner.trim().is_empty()
        || owner.eq_ignore_ascii_case("por definir")
        || owner.eq_ignore_ascii_case("undefined")
    {
        return None;
    }
    Some(PersonId(stable_uuid("person", &owner)))
}

fn validation_from_legacy(status: &str) -> Validation {
    let status = status.to_ascii_lowercase();
    if status.contains("borrador") {
        Validation::Draft
    } else {
        Validation::ToValidate
    }
}

fn resource_kind(value: Option<String>) -> ResourceKind {
    match value.as_deref().map(str::to_ascii_lowercase).as_deref() {
        Some("image") => ResourceKind::Image,
        Some("video") => ResourceKind::Video,
        Some("audio") => ResourceKind::Audio,
        Some("pdf") => ResourceKind::Pdf,
        Some("embed") => ResourceKind::Embed,
        _ => ResourceKind::Link,
    }
}

fn stable_uuid(namespace: &str, value: &str) -> Uuid {
    Uuid::new_v5(&IMPORT_NAMESPACE, format!("{namespace}:{value}").as_bytes())
}

#[cfg(test)]
mod tests {
    use super::import_json;

    #[test]
    fn imports_anonymized_v1_and_reports_audit_gaps() {
        let json = include_str!("../../../fixtures/atlas/schema-v1-anonymized.json");
        let report = import_json(json).expect("fixture is valid");
        assert!(report.has_audit_code("DAT-04"));
        assert!(report.has_audit_code("DAT-05"));
    }

    #[test]
    fn rejects_unsafe_resource_during_import() {
        let json = r#"{
          "schemaVersion": 1,
          "nodes": [{"id":"n1","title":"N","type":"Proceso","x":0,"y":0,"links":[["bad","javascript:alert(1)"]]}],
          "edges": []
        }"#;
        assert!(import_json(json).is_err());
    }
}
