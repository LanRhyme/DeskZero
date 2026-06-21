use crate::models::music::MusicStatus;

#[cfg(target_os = "windows")]
fn get_manager() -> Result<windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager, String> {
    use windows::Media::Control::GlobalSystemMediaTransportControlsSessionManager;

    let async_op = GlobalSystemMediaTransportControlsSessionManager::RequestAsync()
        .map_err(|e| format!("获取媒体控制管理器失败: {:?}", e))?;

    pollster::block_on(async_op)
        .map_err(|e| format!("等待媒体控制管理器失败: {:?}", e))
}

fn get_music_status_sync() -> Result<MusicStatus, String> {
    #[cfg(target_os = "windows")]
    {
        let manager = get_manager()?;
        let session = manager.GetCurrentSession()
            .map_err(|_| "未找到活跃的媒体播放会话".to_string())?;

        let timeline = session.GetTimelineProperties()
            .map_err(|e| format!("获取时间线失败: {:?}", e))?;

        let playback = session.GetPlaybackInfo()
            .map_err(|e| format!("获取播放状态失败: {:?}", e))?;

        let status = playback.PlaybackStatus()
            .map_err(|e| format!("获取播放状态枚举失败: {:?}", e))?;

        let is_playing = status == windows::Media::Control::GlobalSystemMediaTransportControlsSessionPlaybackStatus::Playing;

        let media_props_async = session.TryGetMediaPropertiesAsync()
            .map_err(|e| format!("获取媒体属性失败: {:?}", e))?;

        let (title, artist, album) = match pollster::block_on(media_props_async) {
            Ok(props) => {
                let t = props.Title().unwrap_or_default().to_string();
                let a = props.Artist().unwrap_or_default().to_string();
                let al = props.AlbumTitle().unwrap_or_default().to_string();
                (t, a, al)
            }
            Err(_) => (String::new(), String::new(), String::new()),
        };

        let position_raw = timeline.Position().unwrap_or(windows::Foundation::TimeSpan { Duration: 0 });
        let end_time_raw = timeline.EndTime().unwrap_or(windows::Foundation::TimeSpan { Duration: 0 });
        let position_ms = (position_raw.Duration.max(0) as u64) / 10000;
        let duration_ms = (end_time_raw.Duration.max(0) as u64) / 10000;

        Ok(MusicStatus {
            is_playing,
            title,
            artist,
            album,
            album_art_url: None, // 保持为 None，使用前端默认的高颜值唱片封面
            position_ms,
            duration_ms,
        })
    }
    #[cfg(not(target_os = "windows"))]
    {
        Err("此功能仅支持 Windows".to_string())
    }
}

fn music_play_pause_sync() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let manager = get_manager()?;
        let session = manager.GetCurrentSession()
            .map_err(|_| "未找到媒体会话".to_string())?;

        let playback = session.GetPlaybackInfo().map_err(|e| format!("获取播放信息失败: {:?}", e))?;
        let controls = playback.Controls().map_err(|e| format!("获取控制信息失败: {:?}", e))?;
        
        // 必须先检查播放器是否支持该操作，否则强制调用可能导致某些不兼容的第三方播放器崩溃
        if !controls.IsPlayPauseToggleEnabled().unwrap_or(false) && 
           !controls.IsPlayEnabled().unwrap_or(false) && 
           !controls.IsPauseEnabled().unwrap_or(false) {
            return Err("该播放器不支持播放/暂停控制".to_string());
        }

        let async_op = session.TryTogglePlayPauseAsync()
            .map_err(|e| format!("{:?}", e))?;
        pollster::block_on(async_op)
            .map_err(|e| format!("播放/暂停操作失败: {:?}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { Err("仅支持 Windows".to_string()) }
}

fn music_next_sync() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let manager = get_manager()?;
        let session = manager.GetCurrentSession()
            .map_err(|_| "未找到媒体会话".to_string())?;

        let playback = session.GetPlaybackInfo().map_err(|e| format!("获取播放信息失败: {:?}", e))?;
        let controls = playback.Controls().map_err(|e| format!("获取控制信息失败: {:?}", e))?;
        
        if !controls.IsNextEnabled().unwrap_or(false) {
            return Err("该播放器不支持下一首控制".to_string());
        }

        let async_op = session.TrySkipNextAsync()
            .map_err(|e| format!("{:?}", e))?;
        pollster::block_on(async_op)
            .map_err(|e| format!("下一首操作失败: {:?}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { Err("仅支持 Windows".to_string()) }
}

fn music_prev_sync() -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let manager = get_manager()?;
        let session = manager.GetCurrentSession()
            .map_err(|_| "未找到媒体会话".to_string())?;

        let playback = session.GetPlaybackInfo().map_err(|e| format!("获取播放信息失败: {:?}", e))?;
        let controls = playback.Controls().map_err(|e| format!("获取控制信息失败: {:?}", e))?;
        
        if !controls.IsPreviousEnabled().unwrap_or(false) {
            return Err("该播放器不支持上一首控制".to_string());
        }

        let async_op = session.TrySkipPreviousAsync()
            .map_err(|e| format!("{:?}", e))?;
        pollster::block_on(async_op)
            .map_err(|e| format!("上一首操作失败: {:?}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { Err("仅支持 Windows".to_string()) }
}

fn music_seek_sync(position_ms: u64) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let manager = get_manager()?;
        let session = manager.GetCurrentSession()
            .map_err(|_| "未找到媒体会话".to_string())?;

        let playback = session.GetPlaybackInfo().map_err(|e| format!("获取播放信息失败: {:?}", e))?;
        let controls = playback.Controls().map_err(|e| format!("获取控制信息失败: {:?}", e))?;
        
        if !controls.IsPlaybackPositionEnabled().unwrap_or(false) {
            return Err("该播放器不支持调节进度".to_string());
        }

        let ts = position_ms as i64 * 10000;
        let async_op = session.TryChangePlaybackPositionAsync(ts)
            .map_err(|e| format!("{:?}", e))?;
        pollster::block_on(async_op)
            .map_err(|e| format!("跳转操作失败: {:?}", e))?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    { Err("仅支持 Windows".to_string()) }
}

// 对外公开的异步 tauri command
#[tauri::command]
pub async fn get_music_status() -> Result<MusicStatus, String> {
    tokio::task::spawn_blocking(|| {
        get_music_status_sync()
    })
    .await
    .map_err(|e| format!("读取媒体信息后台线程失败: {:?}", e))?
}

#[tauri::command]
pub async fn music_play_pause() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        music_play_pause_sync()
    })
    .await
    .map_err(|e| format!("执行播放暂停后台线程失败: {:?}", e))?
}

#[tauri::command]
pub async fn music_next() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        music_next_sync()
    })
    .await
    .map_err(|e| format!("下一首后台线程失败: {:?}", e))?
}

#[tauri::command]
pub async fn music_prev() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        music_prev_sync()
    })
    .await
    .map_err(|e| format!("上一首后台线程失败: {:?}", e))?
}

#[tauri::command]
pub async fn music_seek(position_ms: u64) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        music_seek_sync(position_ms)
    })
    .await
    .map_err(|e| format!("跳转位置后台线程失败: {:?}", e))?
}
