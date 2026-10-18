use std::collections::{HashMap, HashSet, hash_map::Entry};

use petgraph::{algo::tarjan_scc, graph::DiGraph, prelude::NodeIndex};
use serde::{Deserialize, Serialize};

use crate::model::{Atlas, EdgeId, EdgeKind, NodeId};

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum IssueCode {
    Dat04,
    Dat05,
    DuplicateNode,
    DanglingEdge,
    SelfEdge,
    DuplicateEdge,
    FlowCycle,
}

impl IssueCode {
    pub const fn audit_id(self) -> &'static str {
        match self {
            Self::Dat04 => "DAT-04",
            Self::Dat05 => "DAT-05",
            Self::DuplicateNode => "ENG-DUPLICATE-NODE",
            Self::DanglingEdge => "ENG-DANGLING-EDGE",
            Self::SelfEdge => "ENG-SELF-EDGE",
            Self::DuplicateEdge => "ENG-DUPLICATE-EDGE",
            Self::FlowCycle => "ENG-FLOW-CYCLE",
        }
    }
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    High,
    Medium,
    Low,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct IntegrityIssue {
    pub code: IssueCode,
    pub severity: Severity,
    pub node: Option<NodeId>,
    pub edge: Option<EdgeId>,
    pub message: String,
}

pub fn validate(atlas: &Atlas) -> Vec<IntegrityIssue> {
    let mut issues = Vec::new();
    let mut node_indexes = HashMap::<NodeId, NodeIndex>::new();
    let mut graph = DiGraph::<NodeId, ()>::new();

    for node in &atlas.nodes {
        if let Entry::Vacant(entry) = node_indexes.entry(node.id) {
            entry.insert(graph.add_node(node.id));
        } else {
            issues.push(IntegrityIssue {
                code: IssueCode::DuplicateNode,
                severity: Severity::High,
                node: Some(node.id),
                edge: None,
                message: "El identificador del nodo está repetido".to_owned(),
            });
        }
        if node.owner.is_none() {
            issues.push(IntegrityIssue {
                code: IssueCode::Dat04,
                severity: Severity::Medium,
                node: Some(node.id),
                edge: None,
                message: "El nodo no tiene responsable asignado".to_owned(),
            });
        }
    }

    let mut touched = HashSet::new();
    let mut seen_edges = HashSet::new();
    for edge in &atlas.edges {
        if edge.from == edge.to {
            issues.push(IntegrityIssue {
                code: IssueCode::SelfEdge,
                severity: Severity::Medium,
                node: Some(edge.from),
                edge: Some(edge.id),
                message: "Una conexión no puede apuntar al mismo nodo".to_owned(),
            });
            continue;
        }
        let identity = (edge.from, edge.to, edge.kind);
        if !seen_edges.insert(identity) {
            issues.push(IntegrityIssue {
                code: IssueCode::DuplicateEdge,
                severity: Severity::Medium,
                node: None,
                edge: Some(edge.id),
                message: "La conexión está repetida".to_owned(),
            });
            continue;
        }
        let (Some(&from), Some(&to)) = (node_indexes.get(&edge.from), node_indexes.get(&edge.to))
        else {
            let missing = if node_indexes.contains_key(&edge.from) {
                edge.to
            } else {
                edge.from
            };
            issues.push(IntegrityIssue {
                code: IssueCode::DanglingEdge,
                severity: Severity::High,
                node: Some(missing),
                edge: Some(edge.id),
                message: "La conexión apunta a un nodo que no existe".to_owned(),
            });
            continue;
        };
        touched.insert(edge.from);
        touched.insert(edge.to);
        if edge.kind == EdgeKind::Flow {
            graph.add_edge(from, to, ());
        }
    }

    for node in &atlas.nodes {
        if !touched.contains(&node.id) {
            issues.push(IntegrityIssue {
                code: IssueCode::Dat05,
                severity: Severity::Medium,
                node: Some(node.id),
                edge: None,
                message: "El nodo está aislado del resto del mapa".to_owned(),
            });
        }
    }

    for component in tarjan_scc(&graph) {
        if component.len() > 1 {
            let first = component
                .first()
                .and_then(|index| graph.node_weight(*index))
                .copied();
            issues.push(IntegrityIssue {
                code: IssueCode::FlowCycle,
                severity: Severity::Medium,
                node: first,
                edge: None,
                message: "El flujo contiene un ciclo".to_owned(),
            });
        }
    }

    issues
}
