#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.len() > 1 && args[1] == "run-service" {
        if let Err(e) = deskzero_lib::service::run_service_main() {
            eprintln!("[DeskZero] Service error: {}", e);
        }
        return;
    }
    deskzero_lib::run()
}
