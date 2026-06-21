use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WeatherData {
    pub temp: String,
    pub text: String,       // weather description
    pub icon: String,       // weather icon code
    pub humidity: String,
    pub wind_dir: String,
    pub wind_scale: String,
    pub feels_like: String,
    pub forecast: Vec<ForecastDay>,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForecastDay {
    pub fx_date: String,
    pub temp_max: String,
    pub temp_min: String,
    pub text_day: String,
    pub icon_day: String,
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LocationInfo {
    pub name: String, // city name
    pub id: String,   // city ID for QWeather
    #[serde(flatten)]
    pub extra: HashMap<String, serde_json::Value>,
}
