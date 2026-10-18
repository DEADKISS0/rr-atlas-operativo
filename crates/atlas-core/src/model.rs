use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(transparent)]
pub struct NodeId(pub Uuid);

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(transparent)]
pub struct EdgeId(pub Uuid);

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(transparent)]
pub struct PersonId(pub Uuid);

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum NodeKind {
    Governance,
    Process,
    Client,
    Prospect,
    ReusableProduct,
    OwnProduct,
    Experiment,
    Area,
    Talent,
    Tool,
    Control,
    Other,
}

impl NodeKind {
    pub fn from_legacy(value: &str) -> Self {
        match value.trim().to_ascii_lowercase().as_str() {
            "gobierno" => Self::Governance,
            "proceso" => Self::Process,
            "cliente" => Self::Client,
            "prospecto" => Self::Prospect,
            "producto reutilizable" => Self::ReusableProduct,
            "producto propio" => Self::OwnProduct,
            "experimento comercial" => Self::Experiment,
            "area" | "área" => Self::Area,
            "talento" => Self::Talent,
            "herramienta" | "herramienta interna" => Self::Tool,
            "control" => Self::Control,
            _ => Self::Other,
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(tag = "state", rename_all = "snake_case")]
pub enum Validation {
    Draft,
    ToValidate,
    Validated { by: PersonId, at: OffsetDateTime },
    Deprecated { reason: String },
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Pos {
    pub x: f32,
    pub y: f32,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceKind {
    Document,
    Image,
    Video,
    Audio,
    Pdf,
    Embed,
    Link,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Resource {
    pub label: String,
    pub url: crate::ResourceUrl,
    pub kind: ResourceKind,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum KindFields {
    Prospect {
        stage: String,
        monthly_cop: Option<u64>,
        next_meeting: Option<OffsetDateTime>,
    },
    Client {
        contract: String,
    },
    Talent {
        role: String,
        person: Option<PersonId>,
    },
    #[default]
    None,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Node {
    pub id: NodeId,
    pub kind: NodeKind,
    pub title: String,
    pub summary: String,
    pub owner: Option<PersonId>,
    pub validation: Validation,
    pub pos: Pos,
    pub resources: Vec<Resource>,
    pub fields: KindFields,
    pub updated_at: OffsetDateTime,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, Hash, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum EdgeKind {
    Flow,
    Owns,
    ClientOf,
    BasedOn,
    PartOf,
    DependsOn,
}

#[derive(Clone, Debug, Deserialize, PartialEq, Serialize)]
pub struct Edge {
    pub id: EdgeId,
    pub from: NodeId,
    pub to: NodeId,
    pub kind: EdgeKind,
    pub label: Option<String>,
}

#[derive(Clone, Debug, Default, Deserialize, PartialEq, Serialize)]
pub struct Atlas {
    pub nodes: Vec<Node>,
    pub edges: Vec<Edge>,
}

impl Atlas {
    pub fn node(&self, id: NodeId) -> Option<&Node> {
        self.nodes.iter().find(|node| node.id == id)
    }

    pub fn node_mut(&mut self, id: NodeId) -> Option<&mut Node> {
        self.nodes.iter_mut().find(|node| node.id == id)
    }

    pub fn remove_edges_for(&mut self, id: NodeId) -> Vec<Edge> {
        let mut removed = Vec::new();
        let mut kept = Vec::with_capacity(self.edges.len());
        for edge in self.edges.drain(..) {
            if edge.from == id || edge.to == id {
                removed.push(edge);
            } else {
                kept.push(edge);
            }
        }
        self.edges = kept;
        removed
    }
}
