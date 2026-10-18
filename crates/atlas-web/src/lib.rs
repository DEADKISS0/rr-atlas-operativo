use leptos::prelude::*;

#[component]
pub fn App() -> impl IntoView {
    view! {
        <main class="atlas-rust-shell" aria-labelledby="atlas-title">
            <p class="atlas-kicker">"RR ALIADOS · FASE 1"</p>
            <h1 id="atlas-title">"RR Atlas Operativo"</h1>
            <p>"Cimientos Rust listos: dominio tipado, validación e importación segura."</p>
        </main>
    }
}
