pub mod backup_store;
pub mod calendar_store;
pub mod container_store;
pub mod countdown_store;
pub mod desktop_store;
pub mod migration;
pub mod settings_store;
pub mod todo_store;
pub mod db;

pub fn init() -> Result<(), String> {
    db::init_db().map_err(|e| e.to_string())?;
    migration::run_migrations();

    // 初始化新小组件的表
    let conn = db::get_connection().map_err(|e| e.to_string())?;
    countdown_store::create_countdown_table(&conn).map_err(|e| e.to_string())?;
    todo_store::create_todo_table(&conn).map_err(|e| e.to_string())?;
    calendar_store::create_calendar_table(&conn).map_err(|e| e.to_string())?;

    Ok(())
}

#[cfg(test)]
mod backup_store_test;
#[cfg(test)]
mod container_store_test;
