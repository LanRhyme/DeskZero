fn main() {
    println!("Testing layout sync...");
    match deskzero_lib::desktop::layout_sync::get_windows_desktop_layout() {
        Ok(layout) => {
            println!("Found {} items in layout via get_windows_desktop_layout", layout.len());
        }
        Err(e) => {
            println!("Error: {}", e);
        }
    }
}
