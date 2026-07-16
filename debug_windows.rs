use std::ffi::c_void;
use std::ptr;

type HWND = *mut c_void;
type BOOL = i32;
type LPCSTR = *const i8;

#[link(name = "user32")]
extern "system" {
    fn FindWindowA(lpClassName: LPCSTR, lpWindowName: LPCSTR) -> HWND;
    fn FindWindowExA(hWndParent: HWND, hWndChildAfter: HWND, lpszClass: LPCSTR, lpszWindow: LPCSTR) -> HWND;
    fn GetClassNameA(hWnd: HWND, lpClassName: *mut i8, nMaxCount: i32) -> i32;
    fn GetWindowThreadProcessId(hWnd: HWND, lpdwProcessId: *mut u32) -> u32;
    fn IsWindowVisible(hWnd: HWND) -> BOOL;
}

#[cfg(target_pointer_width = "64")]
extern "system" {
    fn GetWindowLongPtrA(hWnd: HWND, nIndex: i32) -> isize;
}
#[cfg(target_pointer_width = "32")]
extern "system" {
    fn GetWindowLongA(hWnd: HWND, nIndex: i32) -> i32;
}

fn get_class_name(hwnd: HWND) -> String {
    unsafe {
        let mut buf = [0u8; 256];
        let len = GetClassNameA(hwnd, buf.as_mut_ptr() as *mut i8, 256);
        if len > 0 {
            String::from_utf8_lossy(&buf[..len as usize]).to_string()
        } else {
            String::new()
        }
    }
}

fn get_ex_style(hwnd: HWND) -> isize {
    #[cfg(target_pointer_width = "64")]
    unsafe { GetWindowLongPtrA(hwnd, -20) }
    #[cfg(target_pointer_width = "32")]
    unsafe { GetWindowLongA(hwnd, -20) as isize }
}

fn main() {
    unsafe {
        let progman = FindWindowA(b"Progman\0".as_ptr() as _, ptr::null());
        println!("Progman: {:?}", progman);
        
        let mut worker = ptr::null_mut();
        loop {
            worker = FindWindowExA(ptr::null_mut(), worker, b"WorkerW\0".as_ptr() as _, ptr::null());
            if worker.is_null() { break; }
            println!("WorkerW: {:?}", worker);
            
            let mut child = ptr::null_mut();
            loop {
                child = FindWindowExA(worker, child, ptr::null(), ptr::null());
                if child.is_null() { break; }
                let class_name = get_class_name(child);
                let visible = IsWindowVisible(child) != 0;
                let ex_style = get_ex_style(child);
                println!("  - Child: {:?} | Class: {} | Visible: {} | ExStyle: 0x{:X}", child, class_name, visible, ex_style);
            }
        }
    }
}
