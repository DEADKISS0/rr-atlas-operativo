use thiserror::Error;

use crate::model::{Atlas, Edge, Node, NodeId, NodeKind, PersonId, Pos, Resource, Validation};

#[derive(Clone, Debug, PartialEq)]
pub struct NodePatch {
    pub kind: NodeKind,
    pub title: String,
    pub summary: String,
    pub owner: Option<PersonId>,
    pub validation: Validation,
    pub pos: Pos,
    pub resources: Vec<Resource>,
}

impl NodePatch {
    pub fn from_node(node: &Node) -> Self {
        Self {
            kind: node.kind,
            title: node.title.clone(),
            summary: node.summary.clone(),
            owner: node.owner,
            validation: node.validation.clone(),
            pos: node.pos.clone(),
            resources: node.resources.clone(),
        }
    }

    fn apply_to(&self, node: &mut Node) {
        node.kind = self.kind;
        node.title = self.title.clone();
        node.summary = self.summary.clone();
        node.owner = self.owner;
        node.validation = self.validation.clone();
        node.pos = self.pos.clone();
        node.resources = self.resources.clone();
    }
}

#[derive(Clone, Debug, PartialEq)]
pub enum Command {
    MoveNode {
        id: NodeId,
        from: Pos,
        to: Pos,
    },
    EditNode {
        id: NodeId,
        before: NodePatch,
        after: NodePatch,
    },
    AddNode(Node),
    RemoveNode {
        node: Node,
        edges: Vec<Edge>,
    },
    RestoreNode {
        node: Node,
        edges: Vec<Edge>,
    },
    AddEdge(Edge),
    RemoveEdge(Edge),
}

#[derive(Debug, Error, PartialEq, Eq)]
pub enum HistoryError {
    #[error("nodo no encontrado")]
    NodeNotFound,
    #[error("conexión ya existente")]
    EdgeAlreadyExists,
    #[error("conexión no encontrada")]
    EdgeNotFound,
    #[error("nodo duplicado")]
    NodeAlreadyExists,
}

impl Command {
    pub fn apply(&self, atlas: &mut Atlas) -> Result<(), HistoryError> {
        match self {
            Self::MoveNode { id, to, .. } => {
                let node = atlas.node_mut(*id).ok_or(HistoryError::NodeNotFound)?;
                node.pos = to.clone();
            }
            Self::EditNode { id, after, .. } => {
                let node = atlas.node_mut(*id).ok_or(HistoryError::NodeNotFound)?;
                after.apply_to(node);
            }
            Self::AddNode(node) | Self::RestoreNode { node, .. } => {
                if atlas.node(node.id).is_some() {
                    return Err(HistoryError::NodeAlreadyExists);
                }
                atlas.nodes.push(node.clone());
                if let Self::RestoreNode { edges, .. } = self {
                    atlas.edges.extend(edges.clone());
                }
            }
            Self::RemoveNode { node, .. } => {
                if atlas.node(node.id).is_none() {
                    return Err(HistoryError::NodeNotFound);
                }
                atlas.nodes.retain(|candidate| candidate.id != node.id);
                atlas.remove_edges_for(node.id);
            }
            Self::AddEdge(edge) => {
                if atlas.edges.iter().any(|candidate| candidate.id == edge.id) {
                    return Err(HistoryError::EdgeAlreadyExists);
                }
                atlas.edges.push(edge.clone());
            }
            Self::RemoveEdge(edge) => {
                let before = atlas.edges.len();
                atlas.edges.retain(|candidate| candidate.id != edge.id);
                if before == atlas.edges.len() {
                    return Err(HistoryError::EdgeNotFound);
                }
            }
        }
        Ok(())
    }

    pub fn inverse(&self, atlas: &Atlas) -> Self {
        match self {
            Self::MoveNode { id, from, to } => Self::MoveNode {
                id: *id,
                from: to.clone(),
                to: from.clone(),
            },
            Self::EditNode { id, before, after } => Self::EditNode {
                id: *id,
                before: after.clone(),
                after: before.clone(),
            },
            Self::AddNode(node) => Self::RemoveNode {
                node: node.clone(),
                edges: atlas
                    .edges
                    .iter()
                    .filter(|edge| edge.from == node.id || edge.to == node.id)
                    .cloned()
                    .collect(),
            },
            Self::RemoveNode { node, edges } => Self::RestoreNode {
                node: node.clone(),
                edges: edges.clone(),
            },
            Self::RestoreNode { node, edges } => Self::RemoveNode {
                node: node.clone(),
                edges: edges.clone(),
            },
            Self::AddEdge(edge) => Self::RemoveEdge(edge.clone()),
            Self::RemoveEdge(edge) => Self::AddEdge(edge.clone()),
        }
    }
}

#[derive(Clone, Debug, Default)]
pub struct History {
    undo: Vec<Command>,
    redo: Vec<Command>,
}

impl History {
    pub fn record(&mut self, command: Command) {
        self.undo.push(command);
        self.redo.clear();
    }

    pub fn undo(&mut self, atlas: &mut Atlas) -> Result<bool, HistoryError> {
        let Some(command) = self.undo.pop() else {
            return Ok(false);
        };
        let inverse = command.inverse(atlas);
        inverse.apply(atlas)?;
        self.redo.push(command);
        Ok(true)
    }

    pub fn redo(&mut self, atlas: &mut Atlas) -> Result<bool, HistoryError> {
        let Some(command) = self.redo.pop() else {
            return Ok(false);
        };
        command.apply(atlas)?;
        self.undo.push(command);
        Ok(true)
    }

    pub fn can_undo(&self) -> bool {
        !self.undo.is_empty()
    }

    pub fn can_redo(&self) -> bool {
        !self.redo.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::{Command, History};
    use crate::model::{Atlas, Node, NodeId, NodeKind, Pos, Validation};
    use time::OffsetDateTime;
    use uuid::Uuid;

    fn node() -> Node {
        Node {
            id: NodeId(Uuid::from_u128(1)),
            kind: NodeKind::Process,
            title: "Proceso".to_owned(),
            summary: String::new(),
            owner: None,
            validation: Validation::Draft,
            pos: Pos { x: 0.0, y: 0.0 },
            resources: Vec::new(),
            fields: Default::default(),
            updated_at: OffsetDateTime::UNIX_EPOCH,
        }
    }

    #[test]
    fn move_command_round_trips_with_history() {
        let mut atlas = Atlas {
            nodes: vec![node()],
            edges: vec![],
        };
        let mut history = History::default();
        let command = Command::MoveNode {
            id: NodeId(Uuid::from_u128(1)),
            from: Pos { x: 0.0, y: 0.0 },
            to: Pos { x: 10.0, y: 20.0 },
        };
        command
            .apply(&mut atlas)
            .expect("test command should apply");
        history.record(command);
        assert!(history.undo(&mut atlas).expect("undo should apply"));
        assert_eq!(atlas.nodes[0].pos, Pos { x: 0.0, y: 0.0 });
        assert!(history.redo(&mut atlas).expect("redo should apply"));
        assert_eq!(atlas.nodes[0].pos, Pos { x: 10.0, y: 20.0 });
    }
}
