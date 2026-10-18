use std::env;
use std::process::exit;

use atlas_core::import_json;

fn main() {
    let command = env::args().nth(1).unwrap_or_else(|| "help".to_owned());
    match command.as_str() {
        "help" => {
            println!("xtask comandos: help | integrity-fixture | wasm-budget");
        }
        "integrity-fixture" => {
            let fixture = include_str!("../../../fixtures/atlas/schema-v1-anonymized.json");
            match import_json(fixture) {
                Ok(report) => {
                    let dat04 = report.has_audit_code("DAT-04");
                    let dat05 = report.has_audit_code("DAT-05");
                    println!(
                        "schema={} nodos={} conexiones={} incidencias={} DAT-04={} DAT-05={}",
                        report.schema_version,
                        report.atlas.nodes.len(),
                        report.atlas.edges.len(),
                        report.issues.len(),
                        dat04,
                        dat05
                    );
                    if !dat04 || !dat05 {
                        eprintln!("el fixture no reproduce DAT-04 y DAT-05");
                        exit(1);
                    }
                }
                Err(error) => {
                    eprintln!("falló la importación del fixture: {error}");
                    exit(1);
                }
            }
        }
        "wasm-budget" => {
            println!("Presupuesto inicial propuesto: 700 KB comprimido");
        }
        unknown => {
            eprintln!("comando xtask desconocido: {unknown}");
            exit(2);
        }
    }
}
