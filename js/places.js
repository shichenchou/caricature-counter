export const TW_CITIES = [
  ['基隆', 25.1316, 121.7445],
  ['台北', 25.0375, 121.5637],
  ['新北', 25.0120, 121.4650],
  ['桃園', 24.9936, 121.3010],
  ['新竹市', 24.8066, 120.9686],
  ['新竹縣', 24.8270, 121.0128],
  ['苗栗', 24.5650, 120.8205],
  ['台中', 24.1617, 120.6469],
  ['彰化', 24.0760, 120.5420],
  ['南投', 23.9022, 120.6906],
  ['雲林', 23.6992, 120.5262],
  ['嘉義市', 23.4813, 120.4537],
  ['嘉義縣', 23.4588, 120.2930],
  ['台南', 22.9922, 120.1850],
  ['高雄', 22.6205, 120.3120],
  ['屏東', 22.6828, 120.4878],
  ['宜蘭', 24.7302, 121.7631],
  ['花蓮', 23.9913, 121.6115],
  ['台東', 22.7556, 121.1504],
  ['澎湖', 23.5655, 119.5662],
  ['金門', 24.4369, 118.3186],
  ['連江', 26.1575, 119.9518],
].map(([name, lat, lng]) => ({ name, lat, lng }));

const MAX_KM = 150;

function distanceKm(lat1, lng1, lat2, lng2) {
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(a));
}

// 用「離哪個縣市政府最近」判斷，縣市交界附近可能判錯
export function nearestCity(lat, lng) {
  let best = null;
  let bestKm = Infinity;
  for (const c of TW_CITIES) {
    const km = distanceKm(lat, lng, c.lat, c.lng);
    if (km < bestKm) { bestKm = km; best = c.name; }
  }
  return bestKm > MAX_KM ? null : best;
}

export function defaultTitle(date, city) {
  const md = `${date.getMonth() + 1}/${date.getDate()}`;
  return city ? `${md} ${city}` : md;
}
