use atlas_core::{
    Atlas, Edge, EdgeId, EdgeKind, KindFields, Node, NodeId, NodeKind, Pos, Validation, validate,
};
use proptest::prelude::*;
use time::OffsetDateTime;
use uuid::Uuid;

fn node(index: u128) -> Node {
    Node {
        id: NodeId(Uuid::from_u128(index + 1)),
        kind: NodeKind::Process,
        title: format!("Nodo {index}"),
        summary: String::new(),
        owner: None,
        validation: Validation::Draft,
        pos: Pos {
            x: index as f32,
            y: 0.0,
        },
        resources: Vec::new(),
        fields: KindFields::None,
        updated_at: OffsetDateTime::UNIX_EPOCH,
    }
}

proptest! {
    #[test]
    fn validation_never_panics_for_generated_node_counts(count in 0usize..50) {
        let nodes = (0..count).map(|index| node(index as u128)).collect();
        let atlas = Atlas { nodes, edges: Vec::new() };
        let _ = validate(&atlas);
    }

    #[test]
    fn validation_reports_isolated_nodes(count in 1usize..20) {
        let nodes = (0..count).map(|index| node(index as u128)).collect();
        let atlas = Atlas { nodes, edges: Vec::<Edge>::new() };
        let issues = validate(&atlas);
        prop_assert_eq!(issues.iter().filter(|issue| issue.code.audit_id() == "DAT-05").count(), count);
    }
}

#[test]
fn duplicate_edge_identity_is_reported() {
    let first = node(0);
    let second = node(1);
    let from = first.id;
    let to = second.id;
    let edge = |id| Edge {
        id: EdgeId(Uuid::from_u128(id)),
        from,
        to,
        kind: EdgeKind::Flow,
        label: None,
    };
    let atlas = Atlas {
        nodes: vec![first, second],
        edges: vec![edge(10), edge(11)],
    };
    let issues = validate(&atlas);
    assert!(
        issues
            .iter()
            .any(|issue| issue.code.audit_id() == "ENG-DUPLICATE-EDGE")
    );
}
