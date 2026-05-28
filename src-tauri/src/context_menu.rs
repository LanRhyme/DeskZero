use win_context_menu::{init_com, ContextMenu, ShellItems};

#[tauri::command]
pub fn show_context_menu(paths: Vec<String>, x: i32, y: i32) -> Result<(), String> {
    if paths.is_empty() {
        return Ok(());
    }

    std::thread::spawn(move || {
        // init_com must be called in STA mode on a new thread or the main thread.
        // It's safer to run the menu in a separate thread to avoid blocking the main Tauri event loop
        let _com = match init_com() {
            Ok(com) => com,
            Err(e) => {
                eprintln!("Failed to init COM: {}", e);
                return;
            }
        };

        let items = if paths.len() == 1 {
            ShellItems::from_path(&paths[0])
        } else {
            let str_paths: Vec<&str> = paths.iter().map(|s| s.as_str()).collect();
            ShellItems::from_paths(&str_paths)
        };

        match items {
            Ok(shell_items) => {
                if let Ok(menu) = ContextMenu::new(shell_items) {
                    if let Ok(Some(selected)) = menu.show_at(x, y) {
                        if let Err(e) = selected.execute() {
                            eprintln!("Failed to execute menu item: {}", e);
                        }
                    }
                }
            }
            Err(e) => {
                eprintln!("Failed to create shell items: {}", e);
            }
        }
    });

    Ok(())
}
