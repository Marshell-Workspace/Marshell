fn main() {
  println!("cargo:rerun-if-changed=icons/icon.ico");
  println!("cargo:rerun-if-changed=icons/32x32.png");
  println!("cargo:rerun-if-changed=icons/128x128.png");
  println!("cargo:rerun-if-changed=tauri.conf.json");
  // Regenerate embedded assets when Next.js replaces its hashed export files.
  let attributes = tauri_build::Attributes::new().codegen(tauri_build::CodegenContext::new());
  tauri_build::try_build(attributes).expect("failed to generate Tauri build context");
}
