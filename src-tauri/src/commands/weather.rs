use crate::models::weather::{WeatherData, ForecastDay, LocationInfo};

#[tauri::command]
pub async fn get_weather() -> Result<WeatherData, String> {
    let client = reqwest::Client::new();
    let url = "https://wttr.in/?format=j1&lang=zh-cn";
    
    let resp = client.get(url).send().await.map_err(|e| format!("请求天气失败: {}", e))?
        .json::<serde_json::Value>().await.map_err(|e| format!("解析天气失败: {}", e))?;
        
    let current_condition = resp.get("current_condition")
        .and_then(|v| v.as_array())
        .and_then(|arr| arr.first())
        .ok_or("无实时数据")?;
        
    let weather = resp.get("weather")
        .and_then(|v| v.as_array())
        .ok_or("无预报数据")?;
        
    let map_code = |code: &str| -> String {
        match code {
            "113" => "100", // 晴
            "116" => "101", // 多云
            "119" | "122" => "104", // 阴天
            "143" | "248" | "260" => "500", // 雾
            "176" | "263" | "293" | "296" | "299" | "302" | "305" | "308" | "311" => "300", // 阵雨/小雨
            "200" | "386" | "389" | "392" | "395" => "302", // 雷雨
            "179" | "182" | "185" | "281" | "284" | "314" | "317" | "350" | "377" => "400", // 雨夹雪/冻雨
            "227" | "230" | "320" | "323" | "326" | "329" | "332" | "335" | "338" | "368" | "371" => "401", // 雪
            "353" | "356" | "359" => "301", // 阵雨
            _ => "101",
        }.to_string()
    };
    
    let get_text = |node: &serde_json::Value| -> String {
        node.get("lang_zh-cn")
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .and_then(|v| v.get("value"))
            .and_then(|v| v.as_str())
            .unwrap_or_else(|| {
                node.get("weatherDesc").and_then(|v| v.as_array()).and_then(|a| a.first()).and_then(|v| v.get("value")).and_then(|v| v.as_str()).unwrap_or("未知")
            }).to_string()
    };

    let wcode = current_condition.get("weatherCode").and_then(|v| v.as_str()).unwrap_or("116");
    let text = get_text(current_condition);
        
    let mut forecast = Vec::new();
    for day in weather.iter().take(3) {
        let date = day.get("date").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let max_temp = day.get("maxtempC").and_then(|v| v.as_str()).unwrap_or("--").to_string();
        let min_temp = day.get("mintempC").and_then(|v| v.as_str()).unwrap_or("--").to_string();
        
        let hourly = day.get("hourly").and_then(|v| v.as_array());
        let mid_day = hourly.and_then(|arr| arr.get(4).or_else(|| arr.first()));
        
        let fcode = mid_day.and_then(|v| v.get("weatherCode")).and_then(|v| v.as_str()).unwrap_or("116");
        let ftext = mid_day.map(|v| get_text(v)).unwrap_or_else(|| "未知".to_string());

        forecast.push(ForecastDay {
            fx_date: date,
            temp_max: max_temp,
            temp_min: min_temp,
            text_day: ftext,
            icon_day: map_code(fcode),
        });
    }

    Ok(WeatherData {
        temp: current_condition.get("temp_C").and_then(|v| v.as_str()).unwrap_or("--").to_string(),
        text,
        icon: map_code(wcode),
        humidity: current_condition.get("humidity").and_then(|v| v.as_str()).unwrap_or("--").to_string(),
        wind_dir: current_condition.get("winddir16Point").and_then(|v| v.as_str()).unwrap_or("--").to_string(),
        wind_scale: current_condition.get("windspeedKmph").and_then(|v| v.as_str())
            .map(|kmph| {
                if let Ok(k) = kmph.parse::<f64>() {
                    format!("{:.0}", k / 3.6)
                } else {
                    kmph.to_string()
                }
            })
            .unwrap_or("--".to_string()),
        feels_like: current_condition.get("FeelsLikeC").and_then(|v| v.as_str()).unwrap_or("--").to_string(),
        forecast,
    })
}

#[tauri::command]
pub async fn get_location_by_ip(api_key: String) -> Result<LocationInfo, String> {
    if api_key.is_empty() {
        return Err("请先填写 API Key".to_string());
    }

    let client = reqwest::Client::new();

    // 使用 IP 定位
    let ip_url = "https://whois.pconline.com.cn/ipJson.jsp";
    let ip_resp = client.get(ip_url)
        .send().await.map_err(|e| format!("获取 IP 位置失败: {}", e))?
        .text().await.map_err(|e| format!("读取 IP 响应失败: {}", e))?;

    // 从 JSONP 中提取城市名 (格式: {...city:"xxx"...})
    let city = ip_resp
        .split("city\":\"").nth(1)
        .and_then(|s| s.split('"').next())
        .unwrap_or("北京");

    // 用城市名查询和风天气城市 ID
    let lookup_url = format!("https://geoapi.qweather.com/v2/city/lookup?location={}&key={}", city, api_key);
    let lookup_resp = client.get(&lookup_url)
        .send().await.map_err(|e| format!("查询城市失败: {}", e))?
        .json::<serde_json::Value>().await.map_err(|e| format!("解析城市数据失败: {}", e))?;

    if lookup_resp.get("code").and_then(|c| c.as_str()) != Some("200") {
        return Err(format!("城市查询失败: {}", city));
    }

    let location = lookup_resp.get("location")
        .and_then(|l| l.as_array())
        .and_then(|arr| arr.first())
        .ok_or("未找到城市")?;

    Ok(LocationInfo {
        name: location.get("name").and_then(|v| v.as_str()).unwrap_or(city).to_string(),
        id: location.get("id").and_then(|v| v.as_str()).unwrap_or("101010100").to_string(),
    })
}
