pub mod backup_store;
pub mod container_store;
pub mod settings_store;
pub mod desktop_store;
pub mod db;
pub mod migration;

pub fn init() -> Result<(), String> {
    db::init_db().map_err(|e| e.to_string())?;
    migration::run_migrations();
    Ok(())
}

#[cfg(test)]
mod backup_store_test;
#[cfg(test)]
mod container_store_test;
