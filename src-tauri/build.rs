fn main() {
    println!("cargo:rerun-if-changed=../desktop-dist");
    println!("cargo:rerun-if-changed=update-config.json");
    tauri_build::build()
}
