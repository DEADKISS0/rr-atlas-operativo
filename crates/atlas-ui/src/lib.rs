use atlas_core::{NodeKind, ResourceKind};

pub const BUCM_TOKENS: &[(&str, &str)] = &[
    ("rr-ink", "#070001"),
    ("rr-paper", "#fffff3"),
    ("rr-fuchsia", "#be076d"),
    ("rr-mustard", "#ded116"),
    ("rr-orchid", "#973d8f"),
];

pub fn node_kind_label(kind: NodeKind) -> &'static str {
    match kind {
        NodeKind::Governance => "Gobierno",
        NodeKind::Process => "Proceso",
        NodeKind::Client => "Cliente",
        NodeKind::Prospect => "Prospecto",
        NodeKind::ReusableProduct => "Producto reutilizable",
        NodeKind::OwnProduct => "Producto propio",
        NodeKind::Experiment => "Experimento",
        NodeKind::Area => "Área",
        NodeKind::Talent => "Talento",
        NodeKind::Tool => "Herramienta",
        NodeKind::Control => "Control",
        NodeKind::Other => "Otro",
    }
}

pub fn resource_kind_label(kind: ResourceKind) -> &'static str {
    match kind {
        ResourceKind::Document => "Documento",
        ResourceKind::Image => "Imagen",
        ResourceKind::Video => "Video",
        ResourceKind::Audio => "Audio",
        ResourceKind::Pdf => "PDF",
        ResourceKind::Embed => "Vista previa",
        ResourceKind::Link => "Enlace",
    }
}
